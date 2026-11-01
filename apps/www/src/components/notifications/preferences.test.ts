import { describe, expect, it } from "@effect/vitest";
import {
  preferenceRowsOf,
  relationOfRole,
} from "@/components/notifications/preferences";

describe("preferenceRowsOf", () => {
  it("lists what a student receives, without a mail the poster chooses", () => {
    expect(preferenceRowsOf("student")).toContainEqual({
      channels: ["push"],
      kind: "classAnnouncement",
    });
    expect(preferenceRowsOf("student")).toContainEqual({
      channels: ["push", "email"],
      kind: "examStart",
    });
  });

  it("gives no row to a kind whose only channel always sends", () => {
    expect(preferenceRowsOf("invitee")).toEqual([]);
  });
});

describe("relationOfRole", () => {
  it("reads a student and a guardian as themselves, and every other role as a teacher", () => {
    expect(relationOfRole("student")).toBe("student");
    expect(relationOfRole("guardian")).toBe("guardian");
    expect(relationOfRole("admin")).toBe("teacher");
  });
});
