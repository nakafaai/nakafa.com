import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { isProfileTab, readProfileRoot } from "@/lib/profile/route";

describe("profile address", () => {
  it.each([[[]], [["chat"]]])(
    "names the tab at the segments %j",
    (segments) => {
      expect(isProfileTab(segments)).toBe(true);
    }
  );

  it.each([[["comments"]], [["chat", "more"]], [["chat", "chat"]]])(
    "names no tab at the segments %j",
    (segments) => {
      expect(isProfileTab(segments)).toBe(false);
    }
  );

  it.each([
    ["@nabilfatih", "nabilfatih"],
    ["@Nabil_Fatih", "nabil_fatih"],
    ["@abc", "abc"],
  ])("reads the username of the root %s", (root, username) => {
    expect(readProfileRoot(root)).toEqual(Option.some(username));
  });

  it.each([
    "nabilfatih",
    "user",
    "@",
    "@ab",
    "@1abc",
    "@nabil.md",
    "@nabil%20fatih",
    "@@nabilfatih",
    `@${"a".repeat(21)}`,
  ])("reads no username from the root %s", (root) => {
    expect(readProfileRoot(root)).toEqual(Option.none());
  });
});
