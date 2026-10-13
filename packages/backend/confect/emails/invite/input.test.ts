import { describe, expect, it } from "@effect/vitest";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { insertTestPage } from "@repo/backend/test/content/page";
import { insertRuntimeRelease } from "@repo/backend/test/content/runtime";
import { invitePerson, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect, Schema } from "effect";

const address = Schema.decodeSync(Email)("kepala@harapan.example.test");
const readInput = refs.internal.emails.invite.internal.readInput;

/** The signed legal Pages of every language, as the production release holds them. */
const signedPages = Effect.gen(function* () {
  const ctx = yield* MutationCtx;
  yield* Effect.promise(async () => {
    await insertRuntimeRelease(ctx, ["page"]);
    for (const locale of ACTIVE_APP_LOCALE_CODES) {
      await insertTestPage(ctx, locale, "privacy-policy", `privacy-${locale}`);
      await insertTestPage(ctx, locale, "terms-of-service", `terms-${locale}`);
    }
  });
});

describe("emails/invite/input", () => {
  it.effect.each(ACTIVE_APP_LOCALE_CODES)(
    "says who invited, where to sign in, and the legal links, in %s",
    (locale) =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(signedPages);
        const { inviteId } = yield* fixture.run(
          invitePerson(fixture.tenants.nf, address)
        );
        const input = yield* fixture.internal.query(readInput, {
          inviteId,
          locale,
        });
        expect(input).toEqual({
          locale,
          organisation: "Yayasan Nakafa",
          privacyPolicyUrl: `http://localhost:3000/${locale}/privacy-${locale}`,
          signInUrl: `http://localhost:3000/${locale}/auth`,
          termsOfServiceUrl: `http://localhost:3000/${locale}/terms-${locale}`,
        });
      })
  );

  it.effect("reads nothing for an invite that was revoked", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* fixture.run(signedPages);
      const { inviteId } = yield* fixture.run(
        invitePerson(fixture.tenants.nf, address, {
          invite: { at: 1, status: "revoked" },
        })
      );
      const input = yield* fixture.internal.query(readInput, {
        inviteId,
        locale: "id",
      });
      expect(input).toBeNull();
    })
  );

  it.effect("still reads an invite that an account already accepted", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* fixture.run(signedPages);
      const account = yield* fixture.account("kepala", address, true);
      const { inviteId } = yield* fixture.run(
        invitePerson(fixture.tenants.nf, address, {
          invite: { at: 1, status: "accepted", userId: account.userId },
        })
      );
      const input = yield* fixture.internal.query(readInput, {
        inviteId,
        locale: "id",
      });
      expect(input).toMatchObject({ organisation: "Yayasan Nakafa" });
    })
  );
});
