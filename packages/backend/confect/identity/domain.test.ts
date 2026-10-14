import { describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { checkWorkspaceDomain } from "@repo/backend/confect/identity/domain";
import { NEW_TENANT_POLICIES } from "@repo/backend/confect/tenancy/policy";
import { journal, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const HARAPAN = "harapan.example.test";

/** Sets the email domains the school of the fixture allows. */
const allowDomains = (
  fixture: Effect.Success<typeof tenancyFixture>,
  emailDomains: readonly string[]
) =>
  fixture.run(
    Effect.flatMap(DatabaseWriter, (writer) =>
      writer.table("tenants").patch(fixture.tenants.nf, {
        policies: { ...NEW_TENANT_POLICIES, emailDomains },
      })
    )
  );

/** Runs the check for one Google account of the school, as its sign-in would. */
const check = (
  fixture: Effect.Success<typeof tenancyFixture>,
  hostedDomain: string | undefined
) =>
  fixture.run(
    Effect.gen(function* () {
      const tenant = yield* (yield* DatabaseReader)
        .table("tenants")
        .get(fixture.tenants.nf)
        .pipe(Effect.orDie);
      return yield* checkWorkspaceDomain(tenant, hostedDomain);
    })
  );

describe("identity/domain checkWorkspaceDomain", () => {
  it.effect("allows every account while the school lists no domain", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      expect(yield* check(fixture, undefined)).toBe("allowed");
      expect(yield* check(fixture, HARAPAN)).toBe("allowed");
      expect(yield* fixture.run(journal)).toEqual([]);
    })
  );

  it.effect(
    "allows a Google account whose hosted domain the school lists, in any case",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* allowDomains(fixture, [HARAPAN]);
        expect(yield* check(fixture, "Harapan.Example.Test")).toBe("allowed");
        expect(yield* fixture.run(journal)).toEqual([]);
      })
  );

  it.effect(
    "refuses another hosted domain and journals the refusal as the system",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* allowDomains(fixture, [HARAPAN]);
        expect(yield* check(fixture, "lain.example.test")).toBe("domain");
        expect(yield* fixture.run(journal)).toMatchObject([
          {
            actor: { kind: "system" },
            change: { reason: "domain", type: "identity.blocked" },
            owner: { kind: "tenant", tenantId: fixture.tenants.nf },
            subject: { id: fixture.tenants.nf, kind: "tenant" },
          },
        ]);
      })
  );

  it.effect(
    "refuses a personal Google account, which has no hosted domain, once the school lists domains",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* allowDomains(fixture, [HARAPAN]);
        expect(yield* check(fixture, undefined)).toBe("domain");
        expect(yield* fixture.run(journal)).toHaveLength(1);
      })
  );
});
