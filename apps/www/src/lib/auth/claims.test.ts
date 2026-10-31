import { describe, expect, it } from "@effect/vitest";
import { Effect, Option, Schema } from "effect";
import { Base64Url } from "effect/encoding";
import { readTokenClaims } from "@/lib/auth/claims";

/** The JSON text of a payload. */
const jsonOf = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** A token whose payload holds the claims, between a header and a signature it never reads. */
const tokenOf = (claims: unknown) =>
  `header.${Base64Url.encode(jsonOf(claims))}.signature`;

const CLAIMS = {
  exp: 1_800_000_000,
  name: "Ayu",
  sessionId: "session-ayu",
  sub: "user-ayu",
};

describe("readTokenClaims", () => {
  it.effect("reads the session, the user and the expiry a token names", () =>
    Effect.sync(() => {
      expect(readTokenClaims(tokenOf(CLAIMS))).toEqual(Option.some(CLAIMS));
    })
  );

  it.effect(
    "reads nothing from a text that is not a token, a payload that is not base64url, or claims of another shape",
    () =>
      Effect.sync(() => {
        expect(readTokenClaims("no-dots")).toEqual(Option.none());
        expect(readTokenClaims("header.@@@.signature")).toEqual(Option.none());
        expect(readTokenClaims(tokenOf({ sub: "user-ayu" }))).toEqual(
          Option.none()
        );
      })
  );
});
