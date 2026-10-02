import { FunctionSpec, GroupSpec } from "@confect/core";
import { FunctionImpl } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { ResourceKind } from "@repo/backend/confect/access/catalog";
import { catalog } from "@repo/backend/confect/access/catalog";
import { allowed, authorize } from "@repo/backend/confect/access/check";
import { Kind } from "@repo/backend/confect/access/kind";
import { Authority } from "@repo/backend/confect/access/policy";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import RequireMember, {
  Member,
} from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Person, PersonAccess } from "@repo/backend/confect/tenancy/access";
import {
  personAuthority,
  tenancyAuthorities,
} from "@repo/backend/confect/tenancy/authority";
import { person } from "@repo/backend/confect/tenancy/kinds";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import type { Value } from "convex/values";
import { Cause, Effect, Exit, Schema } from "effect";

const slugOf = Schema.decodeSync(TenantSlug);

/** Two tenants: an Owner, a teacher, and a grant in the first; a Person in the second. */
const seed = Effect.fn(function* () {
  const writer = yield* DatabaseWriter;
  const reader = yield* DatabaseReader;
  const tenant = (slug: string) =>
    writer.table("tenants").insert({
      kind: "school",
      name: "Sekolah",
      slug: slugOf(slug),
      status: "active",
    });
  const home = yield* tenant("home");
  const away = yield* tenant("away");
  const personIn = (tenantId: typeof home, name: string) =>
    writer.table("tenantPeople").insert({
      account: { state: "unclaimed" },
      kind: "member",
      name,
      status: "active",
      tenantId,
    });
  const ownerId = yield* personIn(home, "Owner");
  const teacherId = yield* personIn(home, "Teacher");
  const strangerId = yield* personIn(away, "Stranger");
  const goneId = yield* personIn(home, "Gone");
  yield* writer.table("tenantPeople").delete(goneId);
  const grantOf = (personId: typeof ownerId, key: "owner" | "teacher") =>
    writer
      .table("tenantGrants")
      .insert({
        grantedBy: { kind: "system" },
        personId,
        role: { key, kind: "builtin" },
        scope: { kind: "tenant" },
        status: "active",
        tenantId: home,
        term: { kind: "standing" },
      })
      .pipe(Effect.flatMap((id) => reader.table("tenantGrants").get(id)));
  const ownerGrant = yield* grantOf(ownerId, "owner");
  const teacherGrant = yield* grantOf(teacherId, "teacher");
  const tenantRow = yield* reader.table("tenants").get(home);
  const memberOf = Effect.fn(function* (
    personId: typeof ownerId,
    grant: typeof ownerGrant
  ) {
    return {
      grants: [grant],
      person: yield* reader.table("tenantPeople").get(personId),
      tenant: tenantRow,
    };
  });
  return {
    goneId,
    owner: yield* memberOf(ownerId, ownerGrant),
    strangerId,
    teacher: yield* memberOf(teacherId, teacherGrant),
    teacherGrant,
    teacherId,
    tenantRow,
  };
});

/** Runs a scenario in a mutation with real stored rows. */
const scenario = <A, E extends Value>(
  body: (
    fixture: Effect.Success<ReturnType<typeof seed>>
  ) => Effect.Effect<A, never, DatabaseReader | DatabaseWriter>,
  returns: Schema.Codec<A, E>
) =>
  Effect.gen(function* () {
    const confect = yield* Confect;
    return yield* confect.run(
      seed().pipe(Effect.orDie, Effect.flatMap(body)),
      returns
    );
  }).pipe(Effect.provide(confectLayer));

const outcome = Effect.match({
  onFailure: (error: { readonly reason: string }) => error.reason,
  onSuccess: (row: { readonly name: string }) => row.name,
});

describe("access/check authorize", () => {
  it.effect(
    "returns the checked row and denies foreign, missing, and unpermitted objects",
    () =>
      Effect.gen(function* () {
        const result = yield* scenario(
          ({ goneId, owner, strangerId, teacher, teacherId }) =>
            Effect.all([
              authorize("person", "person.view", teacherId).pipe(
                outcome,
                Effect.provideService(Member, owner)
              ),
              authorize("person", "person.view", strangerId).pipe(
                outcome,
                Effect.provideService(Member, owner)
              ),
              authorize("person", "person.view", goneId).pipe(
                outcome,
                Effect.provideService(Member, owner)
              ),
              authorize("tenant", "grant.manage", teacher.tenant._id).pipe(
                Effect.match({
                  onFailure: (error) => error.reason,
                  onSuccess: () => "allow",
                }),
                Effect.provideService(Member, teacher)
              ),
            ]),
          Schema.mutable(Schema.Array(Schema.String))
        );
        expect(result).toEqual(["Teacher", "resource", "resource", "role"]);
      })
  );

  it.effect("dies on an action no rule of the kind names", () =>
    Effect.gen(function* () {
      const defect = yield* scenario(
        ({ owner, teacherId }) =>
          // @ts-expect-error an action of another kind does not compile
          authorize("person", "grant.view", teacherId).pipe(
            Effect.provideService(Member, owner),
            Effect.exit,
            Effect.map((exit) =>
              Exit.hasDies(exit) ? String(Cause.squash(exit.cause)) : "none"
            )
          ),
        Schema.String
      );
      expect(defect).toContain("grant.view has no rule on kind person");
    })
  );
});

describe("access/check allowed", () => {
  it.effect("lists every action the caller may perform on a loaded row", () =>
    Effect.gen(function* () {
      const result = yield* scenario(
        ({ owner, teacher, teacherGrant, tenantRow }) =>
          Effect.all([
            allowed("tenant", tenantRow).pipe(
              Effect.provideService(Member, owner)
            ),
            allowed("grant", teacherGrant).pipe(
              Effect.provideService(Member, teacher)
            ),
          ]).pipe(
            Effect.map((lists) => lists.map((actions) => [...actions].sort()))
          ),
        Schema.mutable(
          Schema.Array(Schema.mutable(Schema.Array(Schema.String)))
        )
      );
      expect(result).toEqual([
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

describe("access/check compile-time contract", () => {
  const probe = FunctionSpec.publicQuery({
    name: "probe",
    args: () => ({ personId: Id("tenantPeople"), slug: TenantSlug }),
    returns: () => Schema.Null,
  });
  const personOptions = Schema.is(Kind.middleware(catalog, "person").options());
  const tenantOptions = Schema.is(Kind.middleware(catalog, "tenant").options());

  it("types each kind's options from its own and its extensions' actions", () => {
    // @ts-expect-error an action of another kind does not compile
    probe.middleware(PersonAccess, { action: "grant.view", arg: "personId" });
    // @ts-expect-error an object kind names the argument holding its ID
    probe.middleware(PersonAccess, { action: "person.view" });
    // @ts-expect-error the tenant kind takes no argument
    probe.middleware(TenantAccess, { action: "tenant.view", arg: "slug" });
    expect(personOptions({ action: "person.view", arg: "personId" })).toBe(
      true
    );
    expect(personOptions({ action: "grant.view", arg: "personId" })).toBe(
      false
    );
    expect(tenantOptions({ action: "owner.manage" })).toBe(true);
    expect(tenantOptions({ action: "unit.view" })).toBe(false);
  });

  it("gives a handler its subject only through the kind's middleware", () => {
    const group = GroupSpec.make()
      .middleware(Session)
      .middleware(RequireMember)
      .addFunction(probe);
    const handler = Effect.fn(function* () {
      yield* Person;
      return null;
    });
    const impl = FunctionImpl.make(
      databaseSchema,
      group,
      "probe",
      // @ts-expect-error Person is provided only by PersonAccess
      // @effect-diagnostics-next-line missingEffectContext:off
      handler
    );
    expect(impl).toBeDefined();
  });

  it("requires one authority per kind with exactly its declared relations", () => {
    // @ts-expect-error every declared kind needs an authority
    const partial: { readonly [K in ResourceKind]: unknown } = {
      ...tenancyAuthorities,
    };
    const { place, tenantOf } = personAuthority;
    // @ts-expect-error a declared relation without a check does not compile
    const missing = Authority.make(person, { place, relations: {}, tenantOf });
    const extra = Authority.make(person, {
      place,
      relations: {
        // @ts-expect-error a relation the kind does not declare does not compile
        holder: () => Effect.succeed(true),
        self: () => Effect.succeed(true),
      },
      tenantOf,
    });
    expect(Object.keys(partial).sort()).toEqual(["person", "tenant", "unit"]);
    expect([
      missing.relations,
      extra.relations.map(([name]) => name).sort(),
    ]).toEqual([[], ["holder", "self"]]);
  });

  it("rejects a rule that names a relation its kind does not declare", () => {
    const declared = Kind.object({
      actions: {
        "probe.view": {
          access: "read",
          grantedBy: "relations",
          // @ts-expect-error `guardian` is not a relation of this kind
          relations: ["guardian"],
        },
      },
      changes: [],
      name: "probe",
      published: [],
      relations: ["self"],
      table: "tenantPeople",
    });
    expect(declared.ref.fields.kind.literal).toBe("probe");
  });
});
