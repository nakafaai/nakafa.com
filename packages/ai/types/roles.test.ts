import { promptUserRoles } from "@repo/ai/types/roles";
import { describe, expect, it } from "vitest";

describe("prompt user roles", () => {
  it("keeps prompt roles unique", () => {
    expect(new Set(promptUserRoles).size).toBe(promptUserRoles.length);
  });
});
