import { describe, expect, it } from "@effect/vitest";
import { Crown02Icon, StudentIcon } from "@hugeicons/core-free-icons";
import { BuiltinRole } from "@repo/backend/confect/access/schema";
import { Array as Arr } from "effect";
import { roleIcon } from "@/components/tenant/roles";

describe("components/tenant/roles", () => {
  it("gives each built-in role its own icon", () => {
    expect(roleIcon("owner")).toBe(Crown02Icon);
    expect(roleIcon("student")).toBe(StudentIcon);
    expect(Arr.dedupe(Arr.map(BuiltinRole.literals, roleIcon)).length).toBe(
      BuiltinRole.literals.length
    );
  });
});
