import { selfSelectableUserRoles, userRoles } from "@repo/utilities/roles";
import { describe, expect, it } from "vitest";

describe("user roles", () => {
  it("keeps self-selectable roles within all roles", () => {
    expect(
      selfSelectableUserRoles.every((role) => userRoles.includes(role))
    ).toBe(true);
  });

  it("keeps all roles unique", () => {
    expect(new Set(userRoles).size).toBe(userRoles.length);
  });
});
