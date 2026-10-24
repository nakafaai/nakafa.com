import { describe, expect, it } from "@effect/vitest";
import {
  opensTo,
  TenantCapabilities,
  UnitCapabilities,
} from "@repo/backend/confect/access/catalog";
import { RuleRole } from "@repo/backend/confect/access/schema";
import { Array as Arr, Schema } from "effect";

describe("exams/kinds", () => {
  it("grants exam.view to the school's Admin and Teacher, and to no other role but the Owner, who passes every roles rule", () => {
    expect(
      Arr.filter(RuleRole.literals, (role) => opensTo("exam.view", role))
    ).toEqual(["admin", "teacher"]);
  });

  it("opens exam.rooms to the editors and to the sitting viewers, the Principal and the Deputy, and to no other role", () => {
    expect(
      Arr.filter(RuleRole.literals, (role) => opensTo("exam.rooms", role))
    ).toEqual(["admin", "principal", "deputy", "teacher"]);
  });

  it("names exam.view as a capability of the tenant and of a unit, so the viewer reads it on both", () => {
    expect(Schema.decodeSync(TenantCapabilities)(["exam.view"])).toEqual([
      "exam.view",
    ]);
    expect(Schema.decodeSync(UnitCapabilities)(["exam.view"])).toEqual([
      "exam.view",
    ]);
  });
});
