import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { grantAuthority } from "@repo/backend/confect/access/authority";
import type { AccessDenied } from "@repo/backend/confect/access/errors";
import { Authority, decide } from "@repo/backend/confect/access/policy";
import type {
  BuiltinRole,
  GrantScope,
  Rule,
  RuleRole,
} from "@repo/backend/confect/access/schema";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Person } from "@repo/backend/confect/tenancy/access";
import {
  personAuthority,
  tenantAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { person } from "@repo/backend/confect/tenancy/kinds";
import type { TenantStatus } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import type { Value } from "convex/values";
import {
  Array as Arr,
  Cause,
  Effect,
  Exit,
  HashMap,
  Order,
  Schema,
  Struct,
} from "effect";

const slugOf = Schema.decodeSync(TenantSlug);
const system = { kind: "system" } as const;
const Verdicts = Schema.mutable(Schema.Array(Schema.String));
const Named = Schema.Struct({ name: Schema.String });
const read = (roles: readonly (typeof RuleRole.Type)[]): Rule => ({
  access: "read",
  grantedBy: "roles",
  relations: ["member"],
  roles,
});
const write: Rule = {
  access: "write",
  grantedBy: "roles",
  relations: [],
  roles: ["admin"],
};
const guardianOnly: Rule = {
  access: "write",
  grantedBy: "relations",
  relations: ["guardian"],
};
const related = (holds: boolean) =>
  HashMap.make(
    ["member", Effect.succeed(holds)],
    ["guardian", Effect.succeed(holds)]
  );

/** Tenant `home` (two units) and tenant `away`, each with Persons; grants as each case asks. */
const seed = Effect.fn("test.policy.seed")(function* (
  status: typeof TenantStatus.Type
) {
  const writer = yield* DatabaseWriter;
  const reader = yield* DatabaseReader;
  const tenantIn = Effect.fn(function* (slug: string) {
    const id = yield* writer
      .table("tenants")
      .insert({ kind: "school", name: "Sekolah", slug: slugOf(slug), status });
    return yield* reader.table("tenants").get(id);
  });
  const home = yield* tenantIn("home");
  const away = yield* tenantIn("away");
  const unitIn = (name: string) =>
    writer
      .table("tenantUnits")
      .insert({ level: "sd", name, status: "active", tenantId: home._id });
  const near = yield* unitIn("SD Satu");
  const far = yield* unitIn("SD Dua");
  const personIn = Effect.fn(function* (
    tenantId: GenericId.GenericId<"tenants">,
    name: string
  ) {
    const id = yield* writer.table("tenantPeople").insert({
      account: { state: "unclaimed" },
      kind: "member",
      name,
      status: "active",
      tenantId,
    });
    return yield* reader.table("tenantPeople").get(id);
  });
  /** The principal of a Person of `home` holding the given standing grants. */
  const member = Effect.fn(function* (
    name: string,
    grants: ReadonlyArray<readonly [BuiltinRole, GrantScope]>
  ) {
    const holder = yield* personIn(home._id, name);
    const stored = yield* Effect.forEach(grants, ([key, scope]) =>
      writer
        .table("tenantGrants")
        .insert({
          grantedBy: system,
          personId: holder._id,
          role: { key, kind: "builtin" },
          scope,
          status: "active",
          tenantId: home._id,
          term: { kind: "standing" },
        })
        .pipe(Effect.flatMap((id) => reader.table("tenantGrants").get(id)))
    );
    return { grants: stored, person: holder, tenant: home };
  });
  return { away, far, home, member, near, personIn };
});

/** Runs a scenario inside one mutation of a fresh deployment. */
const scenario = <A, E extends Value>(
  status: typeof TenantStatus.Type,
  body: (
    fixture: Effect.Success<ReturnType<typeof seed>>
  ) => Effect.Effect<A, unknown, DatabaseReader | DatabaseWriter>,
  returns: Schema.Codec<A, E>
) =>
  Effect.gen(function* () {
    return yield* (yield* Confect).run(
      seed(status).pipe(Effect.flatMap(body), Effect.orDie),
      returns
    );
  }).pipe(Effect.provide(confectLayer));

const defectOf = <A, E>(exit: Exit.Exit<A, E>) =>
  Exit.hasDies(exit) ? String(Cause.squash(exit.cause)) : "no defect";

describe("access/policy decide", () => {
  it.effect("allows listed roles and every Owner, then relations", () =>
    Effect.gen(function* () {
      const verdicts = yield* scenario(
        "active",
        ({ member }) =>
          Effect.gen(function* () {
            const tenantWide = { locked: false, units: [] };
            const owner = yield* member("Owner", [
              ["owner", { kind: "tenant" }],
            ]);
            const auditor = yield* member("Auditor", [
              ["auditor", { kind: "tenant" }],
            ]);
            return [
              yield* decide(read([]), tenantWide, owner, related(false)),
              yield* decide(
                read(["auditor"]),
                tenantWide,
                auditor,
                related(false)
              ),
              yield* decide(
                read(["admin"]),
                tenantWide,
                auditor,
                related(false)
              ),
              yield* decide(
                read(["admin"]),
                tenantWide,
                auditor,
                related(true)
              ),
            ];
          }),
        Verdicts
      );
      expect(verdicts).toEqual(["allow", "allow", "role", "allow"]);
    })
  );

  it.effect("lets a unit grant cover only its own unit's subjects", () =>
    Effect.gen(function* () {
      const verdicts = yield* scenario(
        "active",
        ({ far, member, near }) =>
          Effect.gen(function* () {
            const principal = yield* member("Principal", [
              ["principal", { kind: "unit", unitId: near }],
            ]);
            return yield* Effect.forEach([[near], [far], []], (units) =>
              decide(
                read(["principal"]),
                { locked: false, units },
                principal,
                related(false)
              )
            );
          }),
        Verdicts
      );
      expect(verdicts).toEqual(["allow", "role", "role"]);
    })
  );

  it.effect(
    "refuses writes on a locked subject or a suspended tenant first",
    () =>
      Effect.gen(function* () {
        const decideFor = (locked: boolean) =>
          Effect.fn(function* ({
            member,
          }: Effect.Success<ReturnType<typeof seed>>) {
            const owner = yield* member("Owner", [
              ["owner", { kind: "tenant" }],
            ]);
            const placement = { locked, units: [] };
            return [
              yield* decide(write, placement, owner, related(true)),
              yield* decide(read([]), placement, owner, related(false)),
            ];
          });
        expect(yield* scenario("active", decideFor(true), Verdicts)).toEqual([
          "condition",
          "allow",
        ]);
        expect(
          yield* scenario("suspended", decideFor(false), Verdicts)
        ).toEqual(["condition", "allow"]);
      })
  );

  it.effect(
    "grants a relations rule through its relations only, never Owner",
    () =>
      Effect.gen(function* () {
        const verdicts = yield* scenario(
          "active",
          ({ member }) =>
            Effect.gen(function* () {
              const owner = yield* member("Owner", [
                ["owner", { kind: "tenant" }],
              ]);
              const placement = { locked: false, units: [] };
              return [
                yield* decide(guardianOnly, placement, owner, related(false)),
                yield* decide(guardianOnly, placement, owner, related(true)),
              ];
            }),
          Verdicts
        );
        expect(verdicts).toEqual(["role", "allow"]);
      })
  );

  it.effect("dies on a rule that names an undeclared relation", () =>
    Effect.gen(function* () {
      const defect = yield* scenario(
        "active",
        ({ member }) =>
          member("Owner", []).pipe(
            Effect.flatMap((owner) =>
              decide(
                guardianOnly,
                { locked: false, units: [] },
                owner,
                HashMap.empty()
              )
            ),
            Effect.exit,
            Effect.map(defectOf)
          ),
        Schema.String
      );
      expect(defect).toContain("undeclared relation guardian");
    })
  );
});

describe("access/policy authority", () => {
  it.effect(
    "returns the checked row and denies foreign, missing, and unpermitted subjects",
    () =>
      Effect.gen(function* () {
        const outcomes = yield* scenario(
          "active",
          ({ away, home, member, personIn }) =>
            Effect.gen(function* () {
              const owner = yield* member("Owner", [
                ["owner", { kind: "tenant" }],
              ]);
              const teacher = yield* member("Teacher", [
                ["teacher", { kind: "tenant" }],
              ]);
              const stranger = yield* personIn(away._id, "Stranger");
              const gone = yield* personIn(home._id, "Gone");
              yield* (yield* DatabaseWriter)
                .table("tenantPeople")
                .delete(gone._id);
              const outcome = Effect.match({
                onFailure: (error: AccessDenied) => error.reason,
                onSuccess: (row: typeof Named.Type) => row.name,
              });
              const asOwner = Effect.provideService(Member, owner);
              return [
                yield* personAuthority
                  .authorize("person.view", teacher.person._id)
                  .pipe(outcome, asOwner),
                yield* personAuthority
                  .authorize("person.view", stranger._id)
                  .pipe(outcome, asOwner),
                yield* personAuthority
                  .authorize("person.view", gone._id)
                  .pipe(outcome, asOwner),
                yield* tenantAuthority
                  .authorize("grant.manage", home._id)
                  .pipe(outcome, Effect.provideService(Member, teacher)),
              ];
            }),
          Verdicts
        );
        expect(outcomes).toEqual(["Teacher", "resource", "resource", "role"]);
      })
  );

  it.effect("dies on an action no rule of the kind names", () =>
    Effect.gen(function* () {
      const defect = yield* scenario(
        "active",
        ({ member }) =>
          member("Owner", [["owner", { kind: "tenant" }]]).pipe(
            Effect.flatMap((owner) =>
              personAuthority
                // @ts-expect-error an action of another kind does not compile
                .check("grant.view", owner.person)
                .pipe(Effect.provideService(Member, owner))
            ),
            Effect.exit,
            Effect.map(defectOf)
          ),
        Schema.String
      );
      expect(defect).toContain("grant.view has no rule on kind person");
    })
  );

  it.effect(
    "lists every action the caller may perform on a loaded subject",
    () =>
      Effect.gen(function* () {
        const lists = yield* scenario(
          "active",
          ({ member }) =>
            Effect.gen(function* () {
              const owner = yield* member("Owner", [
                ["owner", { kind: "tenant" }],
              ]);
              const teacher = yield* member("Teacher", [
                ["teacher", { kind: "tenant" }],
              ]);
              return [
                Arr.sort(
                  yield* tenantAuthority
                    .allowed(owner.tenant)
                    .pipe(Effect.provideService(Member, owner)),
                  Order.String
                ),
                yield* grantAuthority
                  .allowed(yield* Effect.fromOption(Arr.head(teacher.grants)))
                  .pipe(Effect.provideService(Member, teacher)),
              ];
            }),
          Schema.mutable(Schema.Array(Verdicts))
        );
        expect(lists).toEqual([
          [
            "audit.view",
            "grant.manage",
            "owner.manage",
            "tenant.manage",
            "tenant.view",
          ],
          ["grant.view"],
        ]);
      })
  );
});

describe("access/policy journal record", () => {
  it.effect(
    "files each entry under its subject's tenant with the subject's reference",
    () =>
      Effect.gen(function* () {
        const filed = yield* scenario(
          "active",
          ({ away, home, personIn }) =>
            Effect.gen(function* () {
              const first = yield* personIn(home._id, "First");
              const second = yield* personIn(away._id, "Second");
              const reader = yield* DatabaseReader;
              const recorded = [
                yield* personAuthority.record(
                  { id: second._id, kind: "person" },
                  first,
                  { type: "person.created" }
                ),
                yield* personAuthority.record(system, second, {
                  type: "person.removed",
                }),
              ];
              return yield* Effect.forEach(
                Arr.zip(recorded, [first, second]),
                ([id, row]) =>
                  Effect.map(
                    reader.table("journalEntries").get(id),
                    (entry) => ({
                      expected: `${row.tenantId} person:${row._id}`,
                      filed: `${entry.owner.kind === "tenant" ? entry.owner.tenantId : entry.owner.userId} ${entry.subject.kind}:${entry.subject.id}`,
                    })
                  )
              );
            }),
          Schema.mutable(
            Schema.Array(
              Schema.Struct({ expected: Schema.String, filed: Schema.String })
            )
          )
        );
        expect(Arr.map(filed, Struct.get("filed"))).toEqual(
          Arr.map(filed, Struct.get("expected"))
        );
        expect(Arr.dedupe(Arr.map(filed, Struct.get("filed")))).toHaveLength(2);
      })
  );

  it.effect("leaves no entry when the mutation that recorded it fails", () =>
    Effect.gen(function* () {
      const confect = yield* Confect;
      const exit = yield* confect
        .run(
          Effect.gen(function* () {
            const { home, personIn } = yield* seed("active");
            yield* personAuthority.record(
              system,
              yield* personIn(home._id, "Person"),
              { type: "person.created" }
            );
            return yield* Effect.die("the mutation fails after recording");
          }).pipe(Effect.orDie)
        )
        .pipe(Effect.exit);
      const entries = yield* confect.run(
        Effect.gen(function* () {
          return Arr.length(
            yield* (yield* DatabaseReader)
              .table("journalEntries")
              .index("by_creation_time")
              .take(10)
          );
        }).pipe(Effect.orDie),
        Schema.Finite
      );
      expect(Exit.isFailure(exit)).toBe(true);
      expect(entries).toBe(0);
    }).pipe(Effect.provide(confectLayer))
  );

  it.effect(
    "accepts only the subject kind's own changes and never an owner",
    () =>
      Effect.gen(function* () {
        const recorded = yield* scenario(
          "active",
          ({ home, personIn }) =>
            Effect.gen(function* () {
              const holder = yield* personIn(home._id, "Person");
              yield* personAuthority.record(
                system,
                holder,
                // @ts-expect-error a unit change cannot describe a person
                { type: "unit.created" }
              );
              yield* personAuthority.record(
                system,
                holder,
                { type: "person.created" },
                // @ts-expect-error the owner comes from the subject, never from the caller
                { kind: "tenant", tenantId: holder.tenantId }
              );
              return 2;
            }),
          Schema.Finite
        );
        expect(recorded).toBe(2);
      })
  );
});

describe("access/policy kind middleware", () => {
  const run = (arg: string, provided: boolean) =>
    scenario(
      "active",
      ({ member }) =>
        Effect.gen(function* () {
          const owner = yield* member("Owner", [["owner", { kind: "tenant" }]]);
          const strategy = personAuthority
            .middleware(Person)(Effect.die("the handler ran"), {
              invocation: {
                args: { personId: owner.person._id },
                functionType: "query",
                functionVisibility: "public",
                name: "probe",
              },
              options: { action: "person.view", arg },
            })
            .pipe(Effect.provideService(Member, owner));
          return defectOf(
            yield* Effect.exit(
              provided
                ? strategy.pipe(Effect.provideService(Person, owner.person))
                : strategy
            )
          );
        }),
      Schema.String
    );

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

describe("access/policy authority contract", () => {
  it("requires exactly the relations its kind declares", () => {
    const place = () => Effect.succeed({ locked: false, units: [] });
    const tenantOf = (row: TenantPeopleDoc) => row.tenantId;
    const missing = Authority.make(person, Authority.load(person), {
      place,
      // @ts-expect-error a declared relation without a check does not compile
      relations: {},
      tenantOf,
    });
    const extra = Authority.make(person, Authority.load(person), {
      place,
      relations: {
        // @ts-expect-error a relation the kind does not declare does not compile
        holder: () => Effect.succeed(true),
        self: () => Effect.succeed(true),
      },
      tenantOf,
    });
    expect([missing.authorize, extra.authorize]).toHaveLength(2);
  });
});
