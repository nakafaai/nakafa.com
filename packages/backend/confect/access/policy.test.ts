import { describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { Rule } from "@repo/backend/confect/access/kind";
import { Authority, decide } from "@repo/backend/confect/access/policy";
import type {
  BuiltinRole,
  GrantScope,
} from "@repo/backend/confect/access/schema";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Person } from "@repo/backend/confect/tenancy/access";
import { personAuthority } from "@repo/backend/confect/tenancy/authority";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { Cause, Effect, Exit, Schema } from "effect";

const slug = Schema.decodeSync(TenantSlug)("policy");
const nothingRelated = () => Effect.succeed(false);
const everythingRelated = () => Effect.succeed(true);

const read = (roles: readonly Exclude<BuiltinRole, "owner">[]): Rule => ({
  access: "read",
  grantedBy: "roles",
  relations: ["member"],
  roles,
});
const write = {
  access: "write",
  grantedBy: "roles",
  relations: [],
  roles: ["admin"],
} as const;
const relationsOnly = {
  access: "write",
  grantedBy: "relations",
  relations: ["guardian"],
} as const;

/** One stored tenant, two units, and a Person whose grants each case chooses. */
const seed = Effect.fn(function* (status: "active" | "suspended") {
  const writer = yield* DatabaseWriter;
  const reader = yield* DatabaseReader;
  const tenantId = yield* writer
    .table("tenants")
    .insert({ kind: "school", name: "Sekolah", slug, status });
  const unit = (name: string) =>
    writer
      .table("tenantUnits")
      .insert({ level: "sd", name, status: "active", tenantId });
  const near = yield* unit("SD Satu");
  const far = yield* unit("SD Dua");
  const personId = yield* writer.table("tenantPeople").insert({
    account: { state: "unclaimed" },
    kind: "member",
    name: "Person",
    status: "active",
    tenantId,
  });
  const member = Effect.fn(function* (
    grants: readonly { role: BuiltinRole; scope: GrantScope }[]
  ) {
    const stored = yield* Effect.forEach(grants, (grant) =>
      writer
        .table("tenantGrants")
        .insert({
          grantedBy: { kind: "system" },
          personId,
          role: { key: grant.role, kind: "builtin" },
          scope: grant.scope,
          status: "active",
          tenantId,
          term: { kind: "standing" },
        })
        .pipe(Effect.flatMap((id) => reader.table("tenantGrants").get(id)))
    );
    return {
      grants: stored,
      person: yield* reader.table("tenantPeople").get(personId),
      tenant: yield* reader.table("tenants").get(tenantId),
    };
  });
  return { far, member, near };
});

/** Runs one decision table inside a mutation and returns each verdict. */
const verdicts = (
  status: "active" | "suspended",
  cases: (
    fixture: Effect.Success<ReturnType<typeof seed>>
  ) => Effect.Effect<
    readonly string[],
    unknown,
    DatabaseReader | DatabaseWriter
  >
) =>
  Effect.gen(function* () {
    const confect = yield* Confect;
    return yield* confect.run(
      seed(status).pipe(Effect.flatMap(cases), Effect.orDie),
      Schema.mutable(Schema.Array(Schema.String))
    );
  }).pipe(Effect.provide(confectLayer));

describe("access/policy decide", () => {
  it.effect(
    "allows listed roles and every Owner, and refuses the rest by role",
    () =>
      Effect.gen(function* () {
        const result = yield* verdicts("active", ({ member }) =>
          Effect.gen(function* () {
            const tenantWide = { locked: false, units: [] };
            const owner = yield* member([
              { role: "owner", scope: { kind: "tenant" } },
            ]);
            const auditor = yield* member([
              { role: "auditor", scope: { kind: "tenant" } },
            ]);
            return [
              yield* decide(read([]), tenantWide, owner, nothingRelated),
              yield* decide(
                read(["auditor"]),
                tenantWide,
                auditor,
                nothingRelated
              ),
              yield* decide(
                read(["admin"]),
                tenantWide,
                auditor,
                nothingRelated
              ),
              yield* decide(
                read(["admin"]),
                tenantWide,
                auditor,
                everythingRelated
              ),
            ];
          })
        );
        expect(result).toEqual(["allow", "allow", "role", "allow"]);
      })
  );

  it.effect("lets a unit grant cover only its own unit's subjects", () =>
    Effect.gen(function* () {
      const result = yield* verdicts("active", ({ far, member, near }) =>
        Effect.gen(function* () {
          const principal = yield* member([
            { role: "principal", scope: { kind: "unit", unitId: near } },
          ]);
          const rule = read(["principal"]);
          return [
            yield* decide(
              rule,
              { locked: false, units: [near] },
              principal,
              nothingRelated
            ),
            yield* decide(
              rule,
              { locked: false, units: [far] },
              principal,
              nothingRelated
            ),
            yield* decide(
              rule,
              { locked: false, units: [] },
              principal,
              nothingRelated
            ),
          ];
        })
      );
      expect(result).toEqual(["allow", "role", "role"]);
    })
  );

  it.effect(
    "refuses writes on a locked subject or a suspended tenant before any role",
    () =>
      Effect.gen(function* () {
        const locked = yield* verdicts("active", ({ member }) =>
          Effect.gen(function* () {
            const owner = yield* member([
              { role: "owner", scope: { kind: "tenant" } },
            ]);
            return [
              yield* decide(
                write,
                { locked: true, units: [] },
                owner,
                everythingRelated
              ),
              yield* decide(
                read([]),
                { locked: true, units: [] },
                owner,
                nothingRelated
              ),
            ];
          })
        );
        const suspended = yield* verdicts("suspended", ({ member }) =>
          Effect.gen(function* () {
            const owner = yield* member([
              { role: "owner", scope: { kind: "tenant" } },
            ]);
            return [
              yield* decide(
                write,
                { locked: false, units: [] },
                owner,
                nothingRelated
              ),
              yield* decide(
                read([]),
                { locked: false, units: [] },
                owner,
                nothingRelated
              ),
            ];
          })
        );
        expect(locked).toEqual(["condition", "allow"]);
        expect(suspended).toEqual(["condition", "allow"]);
      })
  );

  it.effect(
    "grants a relations rule through its relations only, never through Owner",
    () =>
      Effect.gen(function* () {
        const result = yield* verdicts("active", ({ member }) =>
          Effect.gen(function* () {
            const owner = yield* member([
              { role: "owner", scope: { kind: "tenant" } },
            ]);
            const placement = { locked: false, units: [] };
            return [
              yield* decide(relationsOnly, placement, owner, nothingRelated),
              yield* decide(relationsOnly, placement, owner, everythingRelated),
            ];
          })
        );
        expect(result).toEqual(["role", "allow"]);
      })
  );
});

const defectOf = <A, E>(exit: Exit.Exit<A, E>) =>
  Exit.hasDies(exit) ? String(Cause.squash(exit.cause)) : "no defect";

describe("access/policy kind middleware", () => {
  const run = (arg: string, provided: boolean) =>
    Effect.gen(function* () {
      const confect = yield* Confect;
      return yield* confect.run(
        Effect.gen(function* () {
          const { member } = yield* seed("active");
          const owner = yield* member([
            { role: "owner", scope: { kind: "tenant" } },
          ]);
          const strategy = Authority.middleware(Person, personAuthority)(
            Effect.die("the handler ran"),
            {
              invocation: { args: { personId: owner.person._id } },
              options: { action: "person.view", arg },
            }
          ).pipe(Effect.provideService(Member, owner));
          const exit = yield* Effect.exit(
            provided
              ? strategy.pipe(Effect.provideService(Person, owner.person))
              : strategy
          );
          return defectOf(exit);
        }).pipe(Effect.orDie),
        Schema.String
      );
    }).pipe(Effect.provide(confectLayer));

  it.effect("dies when the same kind's subject is already provided", () =>
    Effect.gen(function* () {
      expect(yield* run("personId", true)).toContain(
        "person access middleware is attached twice"
      );
    })
  );

  it.effect("dies when `arg` names no ID argument", () =>
    Effect.gen(function* () {
      const defect = yield* run("unknown", false);
      expect(defect).not.toBe("no defect");
      expect(defect).not.toContain("the handler ran");
    })
  );

  it.effect("runs the handler once the subject passes its check", () =>
    Effect.gen(function* () {
      expect(yield* run("personId", false)).toContain("the handler ran");
    })
  );
});
