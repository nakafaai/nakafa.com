import { userRoles } from "@repo/ai/types/roles";
import { selfSelectableUserRoles } from "@repo/backend/convex/users/roles";
import { describe, expect, it } from "vitest";

describe("users/roles", () => {
  it("keeps self-selectable roles within persisted roles", () => {
    expect(
      selfSelectableUserRoles.every((role) => userRoles.includes(role))
    ).toBe(true);
  });
});
