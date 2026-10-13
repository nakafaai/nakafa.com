import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { EMAIL_DOMAIN_LIMIT } from "@repo/backend/confect/tenancy/policy";
import {
  journal,
  slugOf,
  suspend,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const nf = slugOf("nf");
const other = slugOf("other");
const viewer = refs.public.tenancy.viewer.get;
const { setLocale, setPolicy } = refs.public.tenancy.settings;
const denied = {
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason: "role",
};
const notMember = { _tag: "NotMember", code: "NOT_MEMBER" };
const invalid = { _tag: "SchemaError" };

describe("tenancy/settings setLocale", () => {
  it.effect(
    "lets an Owner and an Admin set the country and the contract currency, and records each",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const owner = yield* fixture
          .as("owner")
          .mutation(setLocale, { country: "DE", currency: "EUR", slug: nf });
        const admin = yield* fixture
          .as("admin")
          .mutation(setLocale, { country: "SA", currency: "SAR", slug: nf });
        const view = yield* fixture.as("owner").query(viewer, { slug: nf });
        const entries = yield* fixture.run(journal);
        expect(owner).toEqual({ country: "DE", currency: "EUR" });
        expect(admin).toEqual({ country: "SA", currency: "SAR" });
        expect(view.tenant).toMatchObject({ country: "SA", currency: "SAR" });
        expect(entries).toMatchObject([
          {
            actor: { id: fixture.people.owner.personId, kind: "person" },
            change: {
              country: "DE",
              currency: "EUR",
              type: "tenant.locale.set",
            },
            owner: { kind: "tenant", tenantId: fixture.tenants.nf },
            subject: { id: fixture.tenants.nf, kind: "tenant" },
          },
          {
            actor: { id: fixture.people.admin.personId, kind: "person" },
            change: {
              country: "SA",
              currency: "SAR",
              type: "tenant.locale.set",
            },
            subject: { id: fixture.tenants.nf, kind: "tenant" },
          },
        ]);
      })
  );

  it.effect("writes and records nothing for the values already stored", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const answer = yield* fixture
        .as("owner")
        .mutation(setLocale, { country: "ID", currency: "IDR", slug: nf });
      expect(answer).toEqual({ country: "ID", currency: "IDR" });
      expect(yield* fixture.run(journal)).toEqual([]);
    })
  );

  it.effect("refuses a currency or a country that is not a code", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const owner = fixture.as("owner");
      const refusals = yield* Effect.forEach(
        [
          { country: "ID", currency: "IRD" },
          { country: "ID", currency: "idr" },
          { country: "id", currency: "IDR" },
        ],
        (locale) =>
          owner.mutation(setLocale, { ...locale, slug: nf }).pipe(Effect.flip)
      );
      expect(refusals).toMatchObject([invalid, invalid, invalid]);
    })
  );
});

describe("tenancy/settings setPolicy", () => {
  it.effect(
    "changes one policy at a time, leaves the others, and records the change",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const owner = fixture.as("owner");
        const threads = yield* owner.mutation(setPolicy, {
          policy: { key: "studentThreads", value: true },
          slug: nf,
        });
        const nina = yield* owner.mutation(setPolicy, {
          policy: { key: "nina", value: true },
          slug: nf,
        });
        const domains = yield* fixture.as("admin").mutation(setPolicy, {
          policy: {
            key: "emailDomains",
            value: ["harapan.example.test", "belajar.id"],
          },
          slug: nf,
        });
        const view = yield* owner.query(viewer, { slug: nf });
        const entries = yield* fixture.run(journal);
        expect(threads).toEqual({
          emailDomains: [],
          nina: false,
          studentThreads: true,
        });
        expect(nina).toEqual({
          emailDomains: [],
          nina: true,
          studentThreads: true,
        });
        expect(domains).toEqual({
          emailDomains: ["harapan.example.test", "belajar.id"],
          nina: true,
          studentThreads: true,
        });
        expect(view.tenant.policies).toEqual(domains);
        expect(entries).toMatchObject([
          {
            actor: { id: fixture.people.owner.personId, kind: "person" },
            change: {
              policy: { key: "studentThreads", value: true },
              type: "tenant.policy.set",
            },
            subject: { id: fixture.tenants.nf, kind: "tenant" },
          },
          {
            change: {
              policy: { key: "nina", value: true },
              type: "tenant.policy.set",
            },
          },
          {
            actor: { id: fixture.people.admin.personId, kind: "person" },
            change: {
              policy: {
                key: "emailDomains",
                value: ["harapan.example.test", "belajar.id"],
              },
              type: "tenant.policy.set",
            },
          },
        ]);
      })
  );

  it.effect("turns one policy off and leaves the others on", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const owner = fixture.as("owner");
      yield* owner.mutation(setPolicy, {
        policy: { key: "studentThreads", value: true },
        slug: nf,
      });
      yield* owner.mutation(setPolicy, {
        policy: { key: "nina", value: true },
        slug: nf,
      });
      const off = yield* owner.mutation(setPolicy, {
        policy: { key: "nina", value: false },
        slug: nf,
      });
      expect(off).toEqual({
        emailDomains: [],
        nina: false,
        studentThreads: true,
      });
    })
  );

  it.effect("writes and records nothing for the policy already stored", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const answer = yield* fixture.as("owner").mutation(setPolicy, {
        policy: { key: "nina", value: false },
        slug: nf,
      });
      expect(answer).toEqual({
        emailDomains: [],
        nina: false,
        studentThreads: false,
      });
      expect(yield* fixture.run(journal)).toEqual([]);
    })
  );

  it.effect(
    "holds as many email domains as the limit and refuses one more",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const owner = fixture.as("owner");
        const domains = (count: number) =>
          Arr.makeBy(count, (index) => `school-${index}.example.test`);
        const refused = yield* owner
          .mutation(setPolicy, {
            policy: {
              key: "emailDomains",
              value: domains(EMAIL_DOMAIN_LIMIT + 1),
            },
            slug: nf,
          })
          .pipe(Effect.flip);
        const kept = yield* owner.mutation(setPolicy, {
          policy: { key: "emailDomains", value: domains(EMAIL_DOMAIN_LIMIT) },
          slug: nf,
        });
        expect(refused).toMatchObject(invalid);
        expect(kept.emailDomains).toHaveLength(EMAIL_DOMAIN_LIMIT);
      })
  );

  it.effect(
    "refuses a domain that is not a lowercase host name, and a repeated one",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const owner = fixture.as("owner");
        const refusals = yield* Effect.forEach(
          [
            ["Harapan.example.test"],
            ["harapan"],
            ["@harapan.example.test"],
            ["harapan.example.test", "harapan.example.test"],
          ],
          (value) =>
            owner
              .mutation(setPolicy, {
                policy: { key: "emailDomains", value },
                slug: nf,
              })
              .pipe(Effect.flip)
        );
        expect(refusals).toMatchObject([invalid, invalid, invalid, invalid]);
      })
  );
});

describe("tenancy/settings access", () => {
  it.effect(
    "refuses every role but Owner and Admin, a Person without a grant, and a stranger",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const refused = (account: Parameters<typeof fixture.as>[0]) => {
          const client = fixture.as(account);
          return Effect.all([
            client
              .mutation(setLocale, { country: "DE", currency: "EUR", slug: nf })
              .pipe(Effect.flip),
            client
              .mutation(setPolicy, {
                policy: { key: "nina", value: true },
                slug: nf,
              })
              .pipe(Effect.flip),
          ]);
        };
        const byRole = yield* Effect.forEach(
          [
            "teacher",
            "student",
            "principal",
            "auditor",
            "visitor",
            "unitAdmin",
          ] satisfies readonly Parameters<typeof fixture.as>[0][],
          refused
        );
        const outside = yield* Effect.forEach(
          ["suspended", "stranger", "otherOwner"] satisfies readonly Parameters<
            typeof fixture.as
          >[0][],
          refused
        );
        expect(Arr.flatten(byRole)).toMatchObject(Arr.replicate(denied, 12));
        expect(Arr.flatten(outside)).toMatchObject(Arr.replicate(notMember, 6));
        expect(yield* fixture.run(journal)).toEqual([]);
      })
  );

  it.effect("keeps one tenant's settings from another tenant's Owner", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const foreign = yield* fixture
        .as("owner")
        .mutation(setLocale, { country: "SA", currency: "SAR", slug: other })
        .pipe(Effect.flip);
      const stored = yield* fixture.run(
        Effect.flatMap(DatabaseReader, (reader) =>
          reader.table("tenants").get(fixture.tenants.other)
        )
      );
      expect(foreign).toMatchObject(notMember);
      expect(stored).toMatchObject({ country: "DE", currency: "EUR" });
      expect(yield* fixture.run(journal)).toEqual([]);
    })
  );

  it.effect("refuses every write while the tenant is suspended", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* fixture.run(suspend(fixture.tenants.nf));
      const denials = yield* Effect.all([
        fixture
          .as("owner")
          .mutation(setLocale, { country: "DE", currency: "EUR", slug: nf })
          .pipe(Effect.flip),
        fixture
          .as("owner")
          .mutation(setPolicy, {
            policy: { key: "nina", value: true },
            slug: nf,
          })
          .pipe(Effect.flip),
      ]);
      expect(denials).toMatchObject([
        { ...denied, reason: "condition" },
        { ...denied, reason: "condition" },
      ]);
    })
  );

  it.effect("requires a session", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const denial = yield* fixture.anonymous
        .mutation(setPolicy, {
          policy: { key: "nina", value: true },
          slug: nf,
        })
        .pipe(Effect.flip);
      expect(denial).toMatchObject({
        _tag: "SessionRequired",
        code: "UNAUTHENTICATED",
      });
    })
  );
});
