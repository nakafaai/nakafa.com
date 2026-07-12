import { describe, expect, it } from "vitest";
import { updateUserName, updateUserRole } from "@/components/user/state";

describe("current user optimistic state", () => {
  it("updates a name without replacing other projection fields", () => {
    const user = { id: "user-1", name: "Ari" };
    const result = updateUserName(user, "Budi");

    expect(result).toEqual({ id: "user-1", name: "Budi" });
    expect(user.name).toBe("Ari");
  });

  it("updates a role without replacing other app-user fields", () => {
    const user: { id: string; role?: "student" | "teacher" } = {
      id: "user-1",
      role: "student",
    };
    const result = updateUserRole(user, "teacher");

    expect(result).toEqual({ id: "user-1", role: "teacher" });
    expect(user.role).toBe("student");
  });
});
