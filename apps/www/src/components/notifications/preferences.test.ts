import { describe, expect, it } from "@effect/vitest";
import {
  preferenceChoicesOf,
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

describe("preferenceChoicesOf", () => {
  it("keeps every channel on until the reader switches one off", () => {
    expect(preferenceChoicesOf("student", [])).toContainEqual({
      channels: ["push", "email"],
      kind: "examStart",
      on: ["push", "email"],
    });
  });

  it("takes only the channel of the kind the reader switched off", () => {
    const choices = preferenceChoicesOf("student", [
      { channel: "email", kind: "examStart" },
    ]);

    expect(choices).toContainEqual({
      channels: ["push", "email"],
      kind: "examStart",
      on: ["push"],
    });
    expect(choices).toContainEqual({
      channels: ["push"],
      kind: "classAnnouncement",
      on: ["push"],
    });
  });
});

describe("relationOfRole", () => {
  it("reads a student and a guardian as themselves, and every other role as a teacher", () => {
    expect(relationOfRole("student")).toBe("student");
    expect(relationOfRole("guardian")).toBe("guardian");
    expect(relationOfRole("admin")).toBe("teacher");
  });
});
