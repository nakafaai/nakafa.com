// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { canManageSchool } from "@/lib/tenant/manage";

describe("canManageSchool", () => {
  it("tells whether the viewer manages the school from the viewer's own actions", () => {
    expect(canManageSchool(["tenant.manage"])).toBe(true);
    expect(canManageSchool([])).toBe(false);
  });
});
