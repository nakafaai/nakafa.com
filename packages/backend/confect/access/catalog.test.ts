import { describe, expect, it } from "@effect/vitest";
import {
  Change,
  extensions,
  kinds,
  ObjectRef,
  Published,
  TenantAction,
  TenantCapabilities,
} from "@repo/backend/confect/access/catalog";
import { Schema } from "effect";

const sorted = (values: readonly string[]) => [...values].sort();

describe("access/catalog", () => {
  it("derives one object reference per declared kind", () => {
    expect(
      sorted(ObjectRef.members.map((ref) => ref.fields.kind.literal))
    ).toEqual(["grant", "person", "tenant", "unit"]);
    expect(Schema.is(ObjectRef)({ id: "id", kind: "person" })).toBe(true);
    expect(Schema.is(ObjectRef)({ id: "id", kind: "cohort" })).toBe(false);
  });

  it("derives every change of every kind and extension", () => {
    expect(
      sorted(Change.members.map((change) => change.fields.type.literal))
    ).toEqual([
      "grant.created",
      "grant.ended",
      "person.claimed",
      "person.created",
      "person.invited",
      "person.released",
      "person.removed",
      "tenant.provisioned",
      "unit.created",
    ]);
  });

  it("publishes only change types its own entry declares", () => {
    for (const entry of [...kinds, ...extensions]) {
      const declared = entry.changes.map(
        (change) => change.fields.type.literal
      );
      expect(declared).toEqual(expect.arrayContaining([...entry.published]));
    }
    expect(sorted(Published.literals)).toEqual([
      "grant.created",
      "grant.ended",
      "person.claimed",
      "person.created",
      "person.released",
      "person.removed",
      "unit.created",
    ]);
  });

  it("joins tenant actions from the tenant kind and every extension of it", () => {
    expect(
      sorted(TenantAction.members.flatMap((member) => member.literals))
    ).toEqual([
      "audit.view",
      "grant.manage",
      "owner.manage",
      "tenant.manage",
      "tenant.view",
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
