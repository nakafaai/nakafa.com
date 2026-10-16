import { describe, expect, it } from "@effect/vitest";
import {
  Change,
  entries,
  kinds,
  ObjectRef,
  opensTo,
  TenantAction,
  TenantCapabilities,
} from "@repo/backend/confect/access/catalog";
import { Kind } from "@repo/backend/confect/access/kind";
import type { Rule } from "@repo/backend/confect/access/schema";
import { Array as Arr, Option, Order, pipe, Record, Schema } from "effect";

describe("access/catalog", () => {
  it("derives one object reference per declared kind", () => {
    expect(ObjectRef.discriminants).toEqual([
      "tenant",
      "unit",
      "person",
      "period",
      "cohort",
      "grant",
      "integration",
      "class",
      "visit",
      "document",
    ]);
    expect(Schema.is(ObjectRef)({ id: "id", kind: "person" })).toBe(true);
    expect(Schema.is(ObjectRef)({ id: "id", kind: "invoice" })).toBe(false);
  });

  it("opens exactly the roster reads of a school to the integration role", () => {
    const opened = Arr.flatMap(entries, (entry) =>
      Arr.filter(Record.keys<string, Rule>(entry.actions), (action) =>
        opensTo(action, "integration")
      )
    );
    expect(Arr.sort(Arr.dedupe(opened), Order.String)).toEqual([
      "cohort.view",
      "period.view",
      "person.view",
    ]);
  });

  it("opens the document actions to the school's Admin and Teacher, and to no student or integration client", () => {
    for (const action of ["document.view", "document.edit"]) {
      expect(opensTo(action, "admin")).toBe(true);
      expect(opensTo(action, "teacher")).toBe(true);
      expect(opensTo(action, "student")).toBe(false);
      expect(opensTo(action, "integration")).toBe(false);
    }
  });

  it("derives every change of every kind and extension", () => {
    expect(
      Arr.map(Change.members, (change) => change.fields.type.literal)
    ).toEqual([
      "tenant.provisioned",
      "tenant.locale.set",
      "tenant.policy.set",
      "unit.created",
      "unit.locale.set",
      "unit.archived",
      "unit.unarchived",
      "person.created",
      "person.invited",
      "person.claimed",
      "person.released",
      "person.removed",
      "person.renamed",
      "person.placed",
      "person.moved",
      "invite.expired",
      "invite.resent",
      "invite.revoked",
      "period.created",
      "period.opened",
      "period.archived",
      "cohort.created",
      "cohort.renamed",
      "cohort.archived",
      "integration.created",
      "integration.rotated",
      "integration.revoked",
      "class.created",
      "class.renamed",
      "class.archived",
      "class.teacherAssigned",
      "class.teacherRemoved",
      "visit.requested",
      "visit.approved",
      "visit.declined",
      "visit.ended",
      "grant.created",
      "grant.ended",
      "tenant.suspended",
      "tenant.reactivated",
      "person.reactivated",
      "person.suspended",
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
      "invite.view",
      "person.manage",
      "person.view",
      "grant.manage",
      "owner.manage",
      "integration.manage",
      "integration.view",
      "visit.approve",
      "document.edit",
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
