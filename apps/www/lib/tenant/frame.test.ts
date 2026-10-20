// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { GrantView } from "@repo/backend/confect/access/schema";
import { Option, Schema } from "effect";
import {
  canManageSchool,
  firstActiveUnitOf,
  readAccountName,
  roleOf,
} from "@/lib/tenant/frame";

describe("readAccountName", () => {
  it("names an outsider's page after the account's name", () => {
    expect(readAccountName("Ayu", "ayu.harapan")).toEqual(Option.some("Ayu"));
  });

  it("falls back to the username when the account has no name", () => {
    expect(readAccountName("", "ayu.harapan")).toEqual(
      Option.some("ayu.harapan")
    );
  });

  it("names no one when the account has neither a name nor a username", () => {
    expect(readAccountName("", undefined)).toEqual(Option.none());
  });
});

describe("school viewer helpers", () => {
  it("tells whether the viewer manages the school from the viewer's own actions", () => {
    expect(canManageSchool(["tenant.manage"])).toBe(true);
    expect(canManageSchool([])).toBe(false);
  });

  it("reads the first role of the viewer, or none when the viewer holds no grant", () => {
    const grant = Schema.decodeUnknownSync(GrantView)({
      id: "grant-1",
      role: { key: "owner", kind: "builtin" },
      scope: { kind: "tenant" },
      term: { kind: "standing" },
    });
    expect(Option.isNone(roleOf([]))).toBe(true);
    expect(roleOf([grant])).toStrictEqual(Option.some("owner"));
  });

  it("opens the settings on the first active unit", () => {
    const units = [
      { id: "unit-retired", status: "archived" },
      { id: "unit-active", status: "active" },
    ];
    expect(Option.getOrUndefined(firstActiveUnitOf(units))?.id).toBe(
      "unit-active"
    );
    expect(Option.isNone(firstActiveUnitOf([]))).toBe(true);
  });
});
