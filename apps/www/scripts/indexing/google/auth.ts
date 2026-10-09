import { NETWORK_ATTEMPT_DEADLINE } from "@repo/backend/client/network";
import { JsonTextSchema } from "@repo/utilities/json";
import { Clock, Effect, FileSystem, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import {
  GoogleAssertionSignError,
  GoogleTokenRequestError,
} from "@/scripts/indexing/errors";
import { indexingFiles } from "@/scripts/indexing/paths";

const GOOGLE_INDEXING_SCOPE = "https://www.googleapis.com/auth/indexing";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWT_AUDIENCE = GOOGLE_TOKEN_ENDPOINT;
const GOOGLE_JWT_ALGORITHM = "RS256";
const GOOGLE_JWT_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const GOOGLE_JWT_TOKEN_LIFETIME_SECONDS = 3600;
const GoogleServiceAccountSchema = Schema.Struct({
  client_email: Schema.Trimmed.check(Schema.isNonEmpty()),
  private_key: Schema.NonEmptyString,
});
const GoogleTokenResponseSchema = Schema.Struct({
  access_token: Schema.Trimmed.check(Schema.isNonEmpty()),
});
const decodeGoogleServiceAccount = Schema.decodeUnknownEffect(
  Schema.fromJsonString(GoogleServiceAccountSchema)
);
const decodeGoogleTokenResponse = Schema.decodeUnknownEffect(
  Schema.fromJsonString(GoogleTokenResponseSchema)
);
/** Encodes one JWT header or payload as compact JSON for the signed assertion. */
const encodeAssertionSegment = Effect.fn("scripts.google.auth.encodeSegment")(
  function* (segment: unknown) {
    return yield* Schema.encodeEffect(JsonTextSchema)(segment).pipe(
      Effect.orDie
    );
  }
);
/** Loads and validates the service-account key used for eligible URL updates. */
const loadGoogleServiceAccount = Effect.fn(
  "scripts.google.auth.loadServiceAccount"
)(function* () {
  const fs = yield* FileSystem.FileSystem;
  const { googleKey } = yield* indexingFiles;
  const keyFileContent = yield* fs.readFileString(googleKey).pipe(
    Effect.mapError((cause) =>
      GoogleAssertionSignError.make({
        cause,
        message: `Failed to read ${googleKey}.`,
      })
    )
  );
  return yield* decodeGoogleServiceAccount(keyFileContent).pipe(
    Effect.mapError(() =>
      GoogleAssertionSignError.make({
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
  const now = Math.floor((yield* Clock.currentTimeMillis) / 1000);
  const encoder = new TextEncoder();
  const key = yield* Effect.tryPromise({
    try: () =>
      crypto.subtle.importKey(
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
      GoogleAssertionSignError.make({
        cause,
        message: "Failed to import the Google service-account private key.",
      }),
  });
  const encodedHeader = Buffer.from(
    yield* encodeAssertionSegment({
      alg: GOOGLE_JWT_ALGORITHM,
      typ: "JWT",
    })
  ).toString("base64url");
  const encodedPayload = Buffer.from(
    yield* encodeAssertionSegment({
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
      crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        key,
        encoder.encode(signatureInput)
      ),
    catch: (cause) =>
      GoogleAssertionSignError.make({
        cause,
        message: "Failed to sign the Google service-account JWT assertion.",
      }),
  });
  return `${signatureInput}.${Buffer.from(signature).toString("base64url")}`;
});
/** Sends the token request and reads its body. The caller bounds both with one deadline. */
const sendGoogleTokenRequest = Effect.fn(
  "scripts.google.auth.sendTokenRequest"
)(function* (assertion: string) {
  const client = yield* HttpClient.HttpClient;
  const response = yield* HttpClientRequest.post(GOOGLE_TOKEN_ENDPOINT).pipe(
    HttpClientRequest.bodyUrlParams({
      assertion,
      grant_type: GOOGLE_JWT_GRANT_TYPE,
    }),
    client.execute,
    Effect.mapError((cause) =>
      GoogleTokenRequestError.make({
        cause,
        message: "Google token request transport failed.",
      })
    )
  );
  // The body is read whether the endpoint grants or refuses the token.
  const responseText = yield* response.text.pipe(
    Effect.mapError((cause) =>
      GoogleTokenRequestError.make({
        cause,
        message: "Google token response could not be read.",
      })
    )
  );
  return { responseText, status: response.status };
});
/** Exchanges a signed service-account assertion for a Google API access token. */
export const getGoogleAccessToken = Effect.fn("scripts.google.auth.getToken")(
  function* () {
    const assertion = yield* signGoogleAccessTokenAssertion();
    const { responseText, status } = yield* sendGoogleTokenRequest(
      assertion
    ).pipe(
      Effect.timeoutOrElse({
        duration: NETWORK_ATTEMPT_DEADLINE,
        orElse: () =>
          Effect.fail(
            GoogleTokenRequestError.make({
              cause: "deadline",
              message: "Google token request did not answer within 10 seconds.",
            })
          ),
      })
    );
    if (status < 200 || status >= 300) {
      return yield* GoogleTokenRequestError.make({
        message: "Google token request failed.",
        responseText,
      });
    }
    const token = yield* decodeGoogleTokenResponse(responseText).pipe(
      Effect.mapError(() =>
        GoogleTokenRequestError.make({
          cause: "malformed",
          message: "Google token response did not contain an access token.",
        })
      )
    );
    return token.access_token;
  }
);
