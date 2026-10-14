import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { GrantRejected } from "@repo/backend/confect/access/errors";
import {
  assignRole,
  assignTemporaryRole,
  endGrant,
  ensureOwnerRemains,
  OWNER_LIMIT,
} from "@repo/backend/confect/access/grant";
import { GRANT_LIMIT } from "@repo/backend/confect/access/policy";
import type {
  BuiltinRole,
  GrantScope,
} from "@repo/backend/confect/access/schema";
import { NEW_TENANT_POLICIES } from "@repo/backend/confect/tenancy/policy";
import type {
  PersonKind,
  PersonStatus,
} from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  journal,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import type { Value } from "convex/values";
import { Array as Arr, Effect, Ref, Schema } from "effect";

const slug = Schema.decodeSync(TenantSlug)("grants");
const system = { kind: "system" } as const;
const tenantWide: GrantScope = { kind: "tenant" };
const Codes = Schema.mutable(Schema.Array(Schema.String));
const code = Effect.match({
  onFailure: (error: GrantRejected) => error.code,
  onSuccess: () => "ok",
});

/** One tenant with constructors for its Persons, units, and standing grants. */
const tenant = Effect.fn("test.grant.tenant")(function* () {
  const writer = yield* DatabaseWriter;
  const reader = yield* DatabaseReader;
  const tenantId = yield* writer.table("tenants").insert({
    country: "ID",
    currency: "IDR",
    kind: "school",
    name: "Sekolah",
    policies: NEW_TENANT_POLICIES,
    slug,
    status: "active",
  });
  const accounts = yield* Ref.make(0);
  const claimedAccount = Effect.fn(function* () {
    const index = yield* Ref.updateAndGet(accounts, (count) => count + 1);
    const userId = yield* writer.table("users").insert({
      authId: `grants-${index}`,
      credits: 0,
      creditsResetAt: 0,
      email: "person@example.com",
      name: "Person",
      plan: "free",
    });
    return {
      claimedAt: 0,
      method: "invite",
      state: "claimed",
      userId,
    } as const;
  });
  const person = Effect.fn(function* (
    claimed: boolean,
    status: typeof PersonStatus.Type
  ) {
    const id = yield* writer.table("tenantPeople").insert({
      account: claimed ? yield* claimedAccount() : { state: "unclaimed" },
      kind: "member",
      name: "Person",
      status,
      tenantId,
    });
    return yield* reader.table("tenantPeople").get(id);
  });
  const grant = Effect.fn(function* (
    personId: GenericId.GenericId<"tenantPeople">,
    role: BuiltinRole,
    scope: GrantScope
  ) {
    const id = yield* writer.table("tenantGrants").insert({
      grantedBy: system,
      personId,
      role: { key: role, kind: "builtin" },
      scope,
      status: "active",
      tenantId,
      term: { kind: "standing" },
    });
    return yield* reader.table("tenantGrants").get(id);
  });
  const unit = Effect.fn(function* () {
    const unitId = yield* writer.table("tenantUnits").insert({
      contentLanguage: "id",
      level: "sd",
      name: "SD",
      status: "active",
      tenantId,
      timeZone: "Asia/Jakarta",
    });
    return { kind: "unit", unitId } as const;
  });
  return { grant, person, unit };
});

/** Runs one scenario inside a mutation of a fresh deployment. */
const scenario = <A, Failure, E extends Value>(
  body: Effect.Effect<A, Failure, DatabaseReader | DatabaseWriter>,
  returns: Schema.Codec<A, E>
) =>
  Effect.gen(function* () {
    return yield* (yield* Confect).run(body.pipe(Effect.orDie), returns);
  }).pipe(Effect.provide(confectLayer));

describe("access/grant assignRole", () => {
  it.effect(
    "reuses only an active standing grant with the same role and scope",
    () =>
      Effect.gen(function* () {
        const reused = yield* scenario(
          Effect.gen(function* () {
            const { grant, person, unit } = yield* tenant();
            const holder = yield* person(true, "active");
            const near = yield* unit();
            const existing = yield* grant(holder._id, "teacher", near);
            const teach = (scope: GrantScope) =>
              assignRole(system, holder, "teacher", scope);
            const again = yield* teach(near);
            const tenantGrant = yield* teach(tenantWide);
            const otherUnit = yield* teach(yield* unit());
            return [
              again === existing._id,
              tenantGrant === existing._id,
              otherUnit === existing._id,
              (yield* teach(tenantWide)) === tenantGrant,
            ];
          }),
          Schema.mutable(Schema.Array(Schema.Boolean))
        );
        expect(reused).toEqual([true, false, false, true]);
      })
  );

  it.effect(
    "refuses a Person at the grant limit and a tenant at the Owner limit",
    () =>
      Effect.gen(function* () {
        const codes = yield* scenario(
          Effect.gen(function* () {
            const { grant, person, unit } = yield* tenant();
            const busy = yield* person(true, "active");
            yield* Effect.forEach(Arr.range(1, GRANT_LIMIT), () =>
              Effect.flatMap(unit(), (scope) =>
                grant(busy._id, "teacher", scope)
              )
            );
            yield* Effect.forEach(Arr.range(1, OWNER_LIMIT), () =>
              Effect.flatMap(person(true, "active"), (owner) =>
                grant(owner._id, "owner", tenantWide)
              )
            );
            return [
              yield* assignRole(system, busy, "student", tenantWide).pipe(code),
              yield* assignRole(
                system,
                yield* person(true, "active"),
                "owner",
                tenantWide
              ).pipe(code),
            ];
          }),
          Codes
        );
        expect(codes).toEqual(["GRANT_LIMIT", "GRANT_LIMIT"]);
      })
  );
});

describe("access/grant endGrant", () => {
  it.effect(
    "stores an expired term as expired and every other end as revoked",
    () =>
      Effect.gen(function* () {
        const statuses = yield* scenario(
          Effect.gen(function* () {
            const { grant, person } = yield* tenant();
            const holder = yield* person(true, "active");
            const reader = yield* DatabaseReader;
            return yield* Effect.forEach(
              ["expired", "replaced", "revoked"] as const,
              (reason) =>
                Effect.gen(function* () {
                  const ended = yield* grant(holder._id, "teacher", tenantWide);
                  yield* endGrant(system, ended, holder, reason);
                  return (yield* reader.table("tenantGrants").get(ended._id))
                    .status;
                })
            );
          }),
          Codes
        );
        expect(statuses).toEqual(["expired", "revoked", "revoked"]);
      })
  );
});

describe("access/grant ensureOwnerRemains", () => {
  it.effect("counts only other Owners who are active and signed in", () =>
    Effect.gen(function* () {
      const codes = yield* scenario(
        Effect.gen(function* () {
          const { grant, person } = yield* tenant();
          const ownerOf = Effect.fn(function* (
            claimed: boolean,
            status: typeof PersonStatus.Type
          ) {
            return yield* grant(
              (yield* person(claimed, status))._id,
              "owner",
              tenantWide
            );
          });
          const leaving = yield* ownerOf(true, "active");
          const teacher = yield* grant(
            (yield* person(true, "active"))._id,
            "teacher",
            tenantWide
          );
          const alone = [
            yield* ensureOwnerRemains(teacher).pipe(code),
            yield* ensureOwnerRemains(leaving).pipe(code),
          ];
          yield* ownerOf(false, "active");
          yield* ownerOf(true, "suspended");
          const unclaimedOrSuspended =
            yield* ensureOwnerRemains(leaving).pipe(code);
          yield* ownerOf(true, "active");
          return Arr.appendAll(alone, [
            unclaimedOrSuspended,
            yield* ensureOwnerRemains(leaving).pipe(code),
          ]);
        }),
        Codes
      );
      expect(codes).toEqual(["ok", "LAST_OWNER", "LAST_OWNER", "ok"]);
    })
  );
});

/** Inserts one Person of the school, of the given kind and status, and reads it back. */
const insertPerson = Effect.fn("test.grant.insertPerson")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  kind: typeof PersonKind.Type,
  status: typeof PersonStatus.Type
) {
  const reader = yield* DatabaseReader;
  const id = yield* (yield* DatabaseWriter).table("tenantPeople").insert({
    account: { state: "unclaimed" },
    kind,
    name: "Staf",
    status,
    tenantId,
  });
  return yield* reader.table("tenantPeople").get(id);
});

describe("access/grant assignTemporaryRole", () => {
  it.effect(
    "gives an operator a temporary role that ends at its term, and refuses every other temporary grant",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { nf } = fixture.tenants;
        const expiresAt = TENANCY_NOW + 60 * 60 * 1000;
        const visitor = yield* fixture.run(
          insertPerson(nf, "operator", "active")
        );
        const suspended = yield* fixture.run(
          insertPerson(nf, "operator", "suspended")
        );
        const member = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantPeople").get(fixture.people.teacher.personId)
          )
        );
        // The refusal's code, since a typed error is not a value the fixture returns.
        const refusal = (holder: typeof visitor, role: BuiltinRole) =>
          fixture.run(
            assignTemporaryRole(
              { kind: "system" },
              holder,
              role,
              { kind: "tenant" },
              expiresAt
            ).pipe(
              Effect.flip,
              Effect.map((error) => error.code)
            )
          );
        expect([
          yield* refusal(member, "auditor"),
          yield* refusal(suspended, "auditor"),
          yield* refusal(visitor, "integration"),
          yield* refusal(visitor, "owner"),
          yield* refusal(visitor, "admin"),
        ]).toEqual([
          "PERSON_KIND",
          "PERSON_INACTIVE",
          "GRANT_ROLE",
          "TEMPORARY_ROLE",
          "TEMPORARY_ROLE",
        ]);
        const grantId = yield* fixture.run(
          assignTemporaryRole(
            { kind: "system" },
            visitor,
            "auditor",
            { kind: "tenant" },
            expiresAt
          )
        );
        const stored = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantGrants").get(grantId)
          )
        );
        expect(stored).toMatchObject({
          personId: visitor._id,
          role: { key: "auditor", kind: "builtin" },
          status: "active",
          term: { expiresAt, kind: "temporary" },
        });
        expect(yield* fixture.run(journal)).toMatchObject([
          {
            actor: { kind: "system" },
            change: {
              grant: grantId,
              term: { expiresAt, kind: "temporary" },
              type: "grant.created",
            },
            subject: { id: visitor._id, kind: "person" },
          },
        ]);
      })
  );

  it.effect(
    "records a visit grant that the operator left under its reason",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { nf } = fixture.tenants;
        const visitor = yield* fixture.run(
          insertPerson(nf, "operator", "active")
        );
        const grantId = yield* fixture.run(
          assignTemporaryRole(
            { kind: "system" },
            visitor,
            "auditor",
            { kind: "tenant" },
            TENANCY_NOW + 60 * 60 * 1000
          )
        );
        const grantDoc = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantGrants").get(grantId)
          )
        );
        yield* fixture.run(
          endGrant({ kind: "system" }, grantDoc, visitor, "left")
        );
        const stored = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantGrants").get(grantId)
          )
        );
        expect(stored.status).toBe("revoked");
        expect(yield* fixture.run(journal)).toMatchObject([
          { change: { type: "grant.created" } },
          {
            change: { grant: grantId, reason: "left", type: "grant.ended" },
            subject: { id: visitor._id, kind: "person" },
          },
        ]);
      })
  );
});
