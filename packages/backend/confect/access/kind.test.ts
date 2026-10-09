import { FunctionSpec, GroupSpec } from "@confect/core";
import { FunctionImpl } from "@confect/server";
import { describe, expect, expectTypeOf, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { entries } from "@repo/backend/confect/access/catalog";
import { Kind } from "@repo/backend/confect/access/kind";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Person, PersonAccess } from "@repo/backend/confect/tenancy/access";
import { person } from "@repo/backend/confect/tenancy/kinds";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Effect, Schema } from "effect";

const probe = FunctionSpec.publicQuery({
  name: "probe",
  args: () => ({ personId: Id("tenantPeople"), slug: TenantSlug }),
  returns: () => Schema.Null,
});

describe("access/kind declarations", () => {
  it("derives a kind's reference and actions from its declaration", () => {
    const declared = Kind.make("probe", "tenantPeople", {
      actions: {
        "probe.view": {
          access: "read",
          grantedBy: "relations",
          relations: ["self"],
        },
      },
      changes: [],
      published: [],
      relations: ["self"],
    });
    expect(declared.ref.fields.kind.literal).toBe("probe");
    expect(declared.action.literals).toEqual(["probe.view"]);
    expect(declared.table).toBe("tenantPeople");
  });

  it("files an extension under the kind it extends", () => {
    const extended = Kind.extend(person, {
      actions: {},
      changes: [Schema.Struct({ type: Schema.Literal("person.renamed") })],
      published: [],
    });
    expect(extended.kind).toBe("person");
    expect(extended.action.literals).toEqual([]);
  });

  it("joins a kind's actions and changes from its declaration and every extension", () => {
    expect(
      Arr.flatMap(
        Kind.actions(entries, "unit").members,
        (member) => member.literals
      )
    ).toEqual(["unit.view", "grant.manage"]);
    expect(
      Arr.map(
        Kind.changes(entries, "person").members,
        (change) => change.fields.type.literal
      )
    ).toEqual([
      "person.created",
      "person.invited",
      "person.claimed",
      "person.released",
      "person.removed",
      "grant.created",
      "grant.ended",
    ]);
  });
});

describe("access/kind compile-time contract", () => {
  it("types each kind's options from its own and its extensions' actions", () => {
    // @ts-expect-error an action of another kind does not compile
    probe.middleware(PersonAccess, { action: "grant.view", arg: "personId" });
    // @ts-expect-error an object kind names the argument holding its ID
    probe.middleware(PersonAccess, { action: "person.view" });
    // @ts-expect-error the tenant kind takes no argument
    probe.middleware(TenantAccess, { action: "tenant.view", arg: "slug" });
    const personOptions = Schema.is(Kind.options(entries, "person"));
    expect(personOptions({ action: "person.view", arg: "personId" })).toBe(
      true
    );
    expect(personOptions({ action: "grant.view", arg: "personId" })).toBe(
      false
    );
  });

  it("gives a handler its subject only through the kind's middleware", () => {
    const group = GroupSpec.make()
      .middleware(Session)
      .middleware(RequireMember)
      .addFunction(probe);
    type ProbeHandler = Parameters<
      typeof FunctionImpl.make<typeof databaseSchema, typeof group, "probe">
    >[3];
    const needsPerson = Effect.fn(function* () {
      yield* Person;
      return null;
    });
    const needsNothing = () => Effect.succeed(null);

    expectTypeOf(needsPerson).not.toExtend<ProbeHandler>();
    expectTypeOf(needsNothing).toExtend<ProbeHandler>();
    const impl = FunctionImpl.make(
      databaseSchema,
      group,
      "probe",
      needsNothing
    );
    expect(impl).toBeDefined();
  });
});
