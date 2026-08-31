import { userRoles } from "@repo/ai/types/roles";
import {
  isSelfSelectableUserRole,
  selfSelectableUserRoles,
} from "@repo/backend/convex/users/roles";
import { describe, expect, it } from "vitest";

describe("users/roles", () => {
  it("keeps self-selectable roles within persisted roles", () => {
    expect(
      selfSelectableUserRoles.every((role) => userRoles.includes(role))
    ).toBe(true);
  });

  it("rejects privileged and missing roles at the self-service boundary", () => {
    expect(isSelfSelectableUserRole("student")).toBe(true);
    expect(isSelfSelectableUserRole("administrator")).toBe(false);
    expect(isSelfSelectableUserRole(undefined)).toBe(false);
  });
});
