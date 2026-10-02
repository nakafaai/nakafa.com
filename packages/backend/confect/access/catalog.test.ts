import { describe, expect, it } from "@effect/vitest";
import {
  Change,
  entries,
  kinds,
  ObjectRef,
  TenantAction,
  TenantCapabilities,
} from "@repo/backend/confect/access/catalog";
import { Kind } from "@repo/backend/confect/access/kind";
import type { Rule } from "@repo/backend/confect/access/schema";
import { Array as Arr, Option, pipe, Record, Schema } from "effect";

describe("access/catalog", () => {
  it("derives one object reference per declared kind", () => {
    expect(ObjectRef.discriminants).toEqual([
      "tenant",
      "unit",
      "person",
      "grant",
    ]);
    expect(Schema.is(ObjectRef)({ id: "id", kind: "person" })).toBe(true);
    expect(Schema.is(ObjectRef)({ id: "id", kind: "cohort" })).toBe(false);
  });

  it("derives every change of every kind and extension", () => {
    expect(
      Arr.map(Change.members, (change) => change.fields.type.literal)
    ).toEqual([
      "tenant.provisioned",
      "unit.created",
      "person.created",
      "person.invited",
      "person.claimed",
      "person.released",
      "person.removed",
      "grant.created",
      "grant.ended",
    ]);
  });

  it("names only its kind's declared relations in every rule", () => {
    const undeclared = Arr.flatMap(entries, (entry) => {
      const declared = pipe(
        Arr.findFirst(kinds, (kind) => kind.kind === entry.kind),
        Option.map((kind) => kind.relations),
        Option.getOrElse(Arr.empty)
      );
      return pipe(
        Record.values<string, Rule>(entry.actions),
        Arr.flatMap((rule) => rule.relations),
        Arr.filter((relation) => !Arr.contains(declared, relation))
      );
    });
    expect(undeclared).toEqual([]);
  });

  it("rules each action of a kind once, so no lane redefines another lane's rule", () => {
    const repeated = Arr.flatMap(ObjectRef.discriminants, (kind) => {
      const actions = Arr.flatMap(Kind.of(entries, kind), (entry) =>
        Record.keys<string, Rule>(entry.actions)
      );
      return Arr.filter(
        Arr.dedupe(actions),
        (action) =>
          Arr.length(Arr.filter(actions, (other) => other === action)) > 1
      );
    });
    expect(repeated).toEqual([]);
  });

  it("publishes only change types its kind declares", () => {
    const undeclared = Arr.flatMap(ObjectRef.discriminants, (kind) => {
      const declared = Arr.map(
        Kind.changes(entries, kind).members,
        (change) => change.fields.type.literal
      );
      return pipe(
        Kind.of(entries, kind),
        Arr.flatMap((entry): readonly string[] => entry.published),
        Arr.filter((type) => !Arr.some(declared, (known) => known === type))
      );
    });
    expect(undeclared).toEqual([]);
  });

  it("joins tenant actions from the tenant kind and every extension of it", () => {
    expect(
      Arr.flatMap(TenantAction.members, (member) => member.literals)
    ).toEqual([
      "audit.view",
      "tenant.manage",
      "tenant.view",
      "grant.manage",
      "owner.manage",
    ]);
  });

  it("drops capabilities an older client does not know instead of failing", () => {
    const capabilities = Schema.decodeSync(TenantCapabilities)([
      "tenant.view",
      "classroom.create",
    ]);
    expect(capabilities).toEqual(["tenant.view"]);
    expect(Schema.encodeSync(TenantCapabilities)(capabilities)).toEqual([
      "tenant.view",
    ]);
  });
});
