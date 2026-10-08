import { describe, expect, it } from "@effect/vitest";
import { userRoles } from "@repo/backend/confect/users/role";
import {
  isSelfSelectableUserRole,
  selfSelectableUserRoles,
} from "@repo/backend/confect/users/roles";
import { Array as Arr } from "effect";

describe("users/roles", () => {
  it("keeps self-selectable roles within persisted roles", () => {
    expect(
      Arr.every(selfSelectableUserRoles, (role) => userRoles.includes(role))
    ).toBe(true);
  });

  it("rejects privileged and missing roles at the self-service boundary", () => {
    expect(isSelfSelectableUserRole("student")).toBe(true);
    expect(isSelfSelectableUserRole("administrator")).toBe(false);
    expect(isSelfSelectableUserRole(undefined)).toBe(false);
  });
});
