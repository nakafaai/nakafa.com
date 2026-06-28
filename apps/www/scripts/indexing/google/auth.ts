import { webcrypto } from "node:crypto";
import fs from "node:fs";
import { Effect, Schema } from "effect";
import {
  GoogleAssertionSignError,
  GoogleTokenRequestError,
} from "@/scripts/indexing/errors";
import { GOOGLE_KEY_FILE } from "@/scripts/indexing/paths";

const GOOGLE_INDEXING_SCOPE = "https://www.googleapis.com/auth/indexing";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWT_AUDIENCE = GOOGLE_TOKEN_ENDPOINT;
const GOOGLE_JWT_ALGORITHM = "RS256";
const GOOGLE_JWT_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const GOOGLE_JWT_TOKEN_LIFETIME_SECONDS = 3600;

const GoogleServiceAccountSchema = Schema.Struct({
  client_email: Schema.NonEmptyTrimmedString,
  private_key: Schema.NonEmptyString,
});
const GoogleTokenResponseSchema = Schema.Struct({
  access_token: Schema.NonEmptyTrimmedString,
});
const decodeGoogleServiceAccount = Schema.decodeUnknown(
  Schema.parseJson(GoogleServiceAccountSchema)
);
const decodeGoogleTokenResponse = Schema.decodeUnknown(
  Schema.parseJson(GoogleTokenResponseSchema)
);

/** Loads and validates the service-account key used for eligible URL updates. */
const loadGoogleServiceAccount = Effect.fn(
  "scripts.google.auth.loadServiceAccount"
)(function* () {
  const keyFileContent = yield* Effect.try({
    try: () => fs.readFileSync(GOOGLE_KEY_FILE, "utf8"),
    catch: (cause) =>
      new GoogleAssertionSignError({
        cause,
        message: `Failed to read ${GOOGLE_KEY_FILE}.`,
      }),
  });

  return yield* decodeGoogleServiceAccount(keyFileContent).pipe(
    Effect.mapError(
      () =>
        new GoogleAssertionSignError({
          cause: "Invalid google-key.json shape.",
          message:
            "Google service-account credentials must include client_email and private_key.",
        })
    )
  );
});

/** Signs a service-account assertion for Google's OAuth token endpoint. */
const signGoogleAccessTokenAssertion = Effect.fn(
  "scripts.google.auth.signAssertion"
)(function* () {
  const credentials = yield* loadGoogleServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();
  const key = yield* Effect.tryPromise({
    try: () =>
      webcrypto.subtle.importKey(
        "pkcs8",
        Buffer.from(
          credentials.private_key
            .replace("-----BEGIN PRIVATE KEY-----", "")
            .replace("-----END PRIVATE KEY-----", "")
            .replaceAll(/\s/g, ""),
          "base64"
        ),
        {
          hash: "SHA-256",
          name: "RSASSA-PKCS1-v1_5",
        },
        false,
        ["sign"]
      ),
    catch: (cause) =>
      new GoogleAssertionSignError({
        cause,
        message: "Failed to import the Google service-account private key.",
      }),
  });
  const encodedHeader = Buffer.from(
    JSON.stringify({
      alg: GOOGLE_JWT_ALGORITHM,
      typ: "JWT",
    })
  ).toString("base64url");
  const encodedPayload = Buffer.from(
    JSON.stringify({
      aud: GOOGLE_JWT_AUDIENCE,
      exp: now + GOOGLE_JWT_TOKEN_LIFETIME_SECONDS,
      iat: now,
      iss: credentials.client_email,
      scope: GOOGLE_INDEXING_SCOPE,
    })
  ).toString("base64url");
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = yield* Effect.tryPromise({
    try: () =>
      webcrypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        key,
        encoder.encode(signatureInput)
      ),
    catch: (cause) =>
      new GoogleAssertionSignError({
        cause,
        message: "Failed to sign the Google service-account JWT assertion.",
      }),
  });

  return `${signatureInput}.${Buffer.from(signature).toString("base64url")}`;
});

/** Exchanges a signed service-account assertion for a Google API access token. */
export const getGoogleAccessToken = Effect.fn("scripts.google.auth.getToken")(
  function* () {
    const assertion = yield* signGoogleAccessTokenAssertion();
    const tokenResponse = yield* Effect.tryPromise({
      try: () =>
        fetch(GOOGLE_TOKEN_ENDPOINT, {
          body: new URLSearchParams({
            assertion,
            grant_type: GOOGLE_JWT_GRANT_TYPE,
          }),
          method: "POST",
        }).then((response) =>
          response.text().then((responseText) => ({
            ok: response.ok,
            responseText,
          }))
        ),
      catch: (cause) =>
        new GoogleTokenRequestError({
          cause,
          message: "Google token request transport failed.",
        }),
    });

    if (!tokenResponse.ok) {
      return yield* Effect.fail(
        new GoogleTokenRequestError({
          message: "Google token request failed.",
          responseText: tokenResponse.responseText,
        })
      );
    }

    return (yield* decodeGoogleTokenResponse(tokenResponse.responseText))
      .access_token;
  }
);
