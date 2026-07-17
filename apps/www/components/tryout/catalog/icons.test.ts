import { describe, expect, it } from "vitest";
import {
  getTryoutExamIcon,
  getTryoutTrackIcon,
} from "@/components/tryout/catalog/icons";

/** Serialize an icon definition for stable structural assertions. */
function serializeIcon(icon: unknown) {
  return JSON.stringify(icon);
}

describe("try-out icons", () => {
  it("keeps visible exam cards unique by icon", () => {
    const icons = ["snbt", "tka"].map((key) =>
      serializeIcon(getTryoutExamIcon(key))
    );

    expect(new Set(icons).size).toBe(icons.length);
  });

  it("returns a default exam icon for future unsupported exam keys", () => {
    expect(getTryoutExamIcon("unknown-exam")).toBeTruthy();
  });

  it("keeps subject track icons sourced from material icons", () => {
    expect(getTryoutTrackIcon("mathematics")).toBeTruthy();
  });

  it("returns a default track icon for future unsupported track keys", () => {
    expect(getTryoutTrackIcon("unknown-track")).toBeTruthy();
  });
});
