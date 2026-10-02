import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  assignRole,
  endGrant,
  ensureOwnerRemains,
  OWNER_LIMIT,
} from "@repo/backend/confect/access/grant";
import { GRANT_LIMIT } from "@repo/backend/confect/access/policy";
import type { BuiltinRole } from "@repo/backend/confect/access/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import type { Value } from "convex/values";
import { Effect, Schema } from "effect";

const slug = Schema.decodeSync(TenantSlug)("grants");
const system = { kind: "system" } as const;

/** A tenant with helpers to add Persons and their standing grants. */
const tenantWith = Effect.fn(function* () {
  const writer = yield* DatabaseWriter;
  const reader = yield* DatabaseReader;
  const tenantId = yield* writer
    .table("tenants")
    .insert({ kind: "school", name: "Sekolah", slug, status: "active" });
  let accounts = 0;
  const person = Effect.fn(function* (
    account: "claimed" | "unclaimed",
    status: "active" | "suspended" = "active"
  ) {
    accounts += 1;
    const userId =
      account === "claimed"
        ? yield* writer.table("users").insert({
            authId: `grants-${accounts}`,
            credits: 0,
            creditsResetAt: 0,
            email: "person@example.com",
            name: "Person",
            plan: "free",
          })
        : null;
    const personId = yield* writer.table("tenantPeople").insert({
      account: userId
        ? { claimedAt: 0, method: "invite", state: "claimed", userId }
        : { state: "unclaimed" },
      kind: "member",
      name: "Person",
      status,
      tenantId,
    });
    return yield* reader.table("tenantPeople").get(personId);
  });
  const grant = Effect.fn(function* (
    personId: GenericId.GenericId<"tenantPeople">,
    role: BuiltinRole,
    unitId?: GenericId.GenericId<"tenantUnits">
  ) {
    const id = yield* writer.table("tenantGrants").insert({
      grantedBy: system,
      personId,
      role: { key: role, kind: "builtin" },
      scope: unitId ? { kind: "unit", unitId } : { kind: "tenant" },
      status: "active",
      tenantId,
      term: { kind: "standing" },
    });
    return yield* reader.table("tenantGrants").get(id);
  });
  const unit = () =>
    writer
      .table("tenantUnits")
      .insert({ level: "sd", name: "SD", status: "active", tenantId });
  return { grant, person, unit };
});

const run = <A, E extends Value>(
  body: Effect.Effect<A, never, DatabaseReader | DatabaseWriter>,
  returns: Schema.Codec<A, E>
) =>
  Effect.gen(function* () {
    return yield* (yield* Confect).run(body, returns);
  }).pipe(Effect.provide(confectLayer));

const code = Effect.match({
  onFailure: (error: { readonly code: string }) => error.code,
  onSuccess: () => "ok",
});

describe("access/grant assignRole", () => {
  it.effect(
    "reuses only an active standing grant with the same role and scope",
    () =>
      Effect.gen(function* () {
        const result = yield* run(
          Effect.gen(function* () {
            const { grant, person, unit } = yield* tenantWith();
            const holder = yield* person("claimed");
            const unitId = yield* unit();
            const unitGrant = yield* grant(holder._id, "teacher", unitId);
            const assign = (scope: Parameters<typeof assignRole>[0]["scope"]) =>
              assignRole({
                actor: system,
                person: holder,
                role: "teacher",
                scope,
              });
            const again = yield* assign({ kind: "unit", unitId });
            const tenantWide = yield* assign({ kind: "tenant" });
            const otherUnit = yield* assign({
              kind: "unit",
              unitId: yield* unit(),
            });
            return [
              again === unitGrant._id,
              tenantWide === unitGrant._id,
              otherUnit === unitGrant._id,
              (yield* assign({ kind: "tenant" })) === tenantWide,
            ];
          }).pipe(Effect.orDie),
          Schema.mutable(Schema.Array(Schema.Boolean))
        );
        expect(result).toEqual([true, false, false, true]);
      })
  );

  it.effect("refuses a Person already at the grant limit", () =>
    Effect.gen(function* () {
      const result = yield* run(
        Effect.gen(function* () {
          const { grant, person, unit } = yield* tenantWith();
          const busy = yield* person("claimed");
          for (let index = 0; index < GRANT_LIMIT; index += 1) {
            yield* grant(busy._id, "teacher", yield* unit());
          }
          return yield* assignRole({
            actor: system,
            person: busy,
            role: "student",
            scope: { kind: "tenant" },
          }).pipe(code);
        }).pipe(Effect.orDie),
        Schema.String
      );
      expect(result).toBe("GRANT_LIMIT");
    })
  );

  it.effect("refuses a new Owner once the tenant holds the Owner limit", () =>
    Effect.gen(function* () {
      const result = yield* run(
        Effect.gen(function* () {
          const { grant, person } = yield* tenantWith();
          for (let index = 0; index < OWNER_LIMIT; index += 1) {
            yield* grant((yield* person("claimed"))._id, "owner");
          }
          return yield* assignRole({
            actor: system,
            person: yield* person("claimed"),
            role: "owner",
            scope: { kind: "tenant" },
          }).pipe(code);
        }).pipe(Effect.orDie),
        Schema.String
      );
      expect(result).toBe("GRANT_LIMIT");
    })
  );
});

describe("access/grant endGrant", () => {
  it.effect(
    "stores an expired term as expired and every other end as revoked",
    () =>
      Effect.gen(function* () {
        const result = yield* run(
          Effect.gen(function* () {
            const { grant, person } = yield* tenantWith();
            const holder = yield* person("claimed");
            const reader = yield* DatabaseReader;
            return yield* Effect.forEach(
              ["expired", "replaced", "revoked"] as const,
              (reason) =>
                Effect.gen(function* () {
                  const ended = yield* grant(holder._id, "teacher");
                  yield* endGrant({
                    actor: system,
                    grant: ended,
                    holder,
                    reason,
                  });
                  return (yield* reader.table("tenantGrants").get(ended._id))
                    .status;
                })
            );
          }).pipe(Effect.orDie),
          Schema.mutable(Schema.Array(Schema.String))
        );
        expect(result).toEqual(["expired", "revoked", "revoked"]);
      })
  );
});

describe("access/grant ensureOwnerRemains", () => {
  it.effect("counts only other Owners who are active and signed in", () =>
    Effect.gen(function* () {
      const result = yield* run(
        Effect.gen(function* () {
          const { grant, person } = yield* tenantWith();
          const leaving = yield* grant((yield* person("claimed"))._id, "owner");
          const teacher = yield* grant(
            (yield* person("claimed"))._id,
            "teacher"
          );
          const verdicts = [
            yield* ensureOwnerRemains(teacher).pipe(code),
            yield* ensureOwnerRemains(leaving).pipe(code),
          ];
          yield* grant((yield* person("unclaimed"))._id, "owner");
          yield* grant((yield* person("claimed", "suspended"))._id, "owner");
          verdicts.push(yield* ensureOwnerRemains(leaving).pipe(code));
          yield* grant((yield* person("claimed"))._id, "owner");
          verdicts.push(yield* ensureOwnerRemains(leaving).pipe(code));
          return verdicts;
        }).pipe(Effect.orDie),
        Schema.mutable(Schema.Array(Schema.String))
      );
      expect(result).toEqual(["ok", "LAST_OWNER", "LAST_OWNER", "ok"]);
    })
  );
});
