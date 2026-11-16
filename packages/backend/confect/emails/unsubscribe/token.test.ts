import { describe, expect, it } from "@effect/vitest";
import { Recipient } from "@repo/backend/confect/emails/unsubscribe/schema";
import {
  readToken,
  suppressedAddress,
  tokenOf,
  unsubscribePage,
  unsubscribePost,
} from "@repo/backend/confect/emails/unsubscribe/token";
import { signUnsubscribe } from "@repo/backend/confect/identity/secret";
import { Effect, Schema, String as Str } from "effect";
import { Base64Url } from "effect/encoding";

const recipientOf = Schema.decodeUnknownSync(Recipient);

/** An account a token may name; only its shape matters to a token. */
const ACCOUNT = recipientOf({ _tag: "Account", userId: "users_1" });

/** The code of the failure a text reads as. */
const failureOf = (token: string) =>
  readToken(token).pipe(
    Effect.flip,
    Effect.map(({ code }) => code)
  );

describe("emails/unsubscribe/token", () => {
  it.effect(
    "reads back the recipient each kind of token names: an account, a Person, an address",
    () =>
      Effect.gen(function* () {
        for (const recipient of [
          ACCOUNT,
          recipientOf({
            _tag: "Person",
            personId: "people_1",
            tenantId: "tenants_1",
          }),
          recipientOf({ _tag: "Address", address: "wali@example.test" }),
        ]) {
          expect(yield* readToken(yield* tokenOf(recipient))).toEqual(
            recipient
          );
        }
      })
  );

  it.effect(
    "refuses a token whose hash does not match, a text that is no token, and a signed payload that names no recipient",
    () =>
      Effect.gen(function* () {
        const token = yield* tokenOf(ACCOUNT);
        const [payload = ""] = Str.split(".")(token);
        expect(
          yield* failureOf(`${payload}.${yield* signUnsubscribe("another")}`)
        ).toBe("UNSUBSCRIBE_TOKEN_INVALID");
        expect(yield* failureOf(`${token}.extra`)).toBe(
          "UNSUBSCRIBE_TOKEN_INVALID"
        );
        expect(yield* failureOf("")).toBe("UNSUBSCRIBE_TOKEN_INVALID");
        // Signed by the server, yet no Base64Url, or no recipient once decoded.
        const unreadable = "not*base64";
        expect(
          yield* failureOf(
            `${unreadable}.${yield* signUnsubscribe(unreadable)}`
          )
        ).toBe("UNSUBSCRIBE_TOKEN_INVALID");
        const stranger = Base64Url.encode('{"_tag":"Robot"}');
        expect(
          yield* failureOf(`${stranger}.${yield* signUnsubscribe(stranger)}`)
        ).toBe("UNSUBSCRIBE_TOKEN_INVALID");
      })
  );

  it.effect(
    "links the page in the email's language and the one-click address on the Convex site, both with the token",
    () =>
      Effect.gen(function* () {
        const token = yield* tokenOf(ACCOUNT);
        const page = new URL(yield* unsubscribePage(ACCOUNT, "de"));
        expect(`${page.origin}${page.pathname}`).toBe(
          "http://localhost:3000/de/unsubscribe"
        );
        expect(page.searchParams.get("token")).toBe(token);
        const { post } = yield* unsubscribePost(ACCOUNT);
        expect(post).toBe(
          `https://example.convex.site/email/unsubscribe?token=${token}`
        );
      })
  );

  it("matches an address however its sender wrote it", () => {
    expect(suppressedAddress("  Wali@Example.TEST ")).toBe("wali@example.test");
  });
});
