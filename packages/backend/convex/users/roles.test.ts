import { promptUserRoles } from "@repo/ai/types/roles";
import {
  selfSelectableUserRoles,
  userRoles,
} from "@repo/backend/convex/users/roles";
import { describe, expect, it } from "vitest";

describe("users/roles", () => {
  it("keeps persisted user roles unique", () => {
    expect(new Set(userRoles).size).toBe(userRoles.length);
  });

  it("keeps self-selectable roles within persisted roles", () => {
    expect(
      selfSelectableUserRoles.every((role) => userRoles.includes(role))
    ).toBe(true);
  });

  it("keeps AI prompt roles aligned with persisted user roles", () => {
    expect(promptUserRoles).toEqual(userRoles);
  });
});
