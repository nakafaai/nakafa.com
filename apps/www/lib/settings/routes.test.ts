import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  getUserSettingsSection,
  isUserSettingsPath,
  userSettingsGroups,
  userSettingsSections,
} from "@/lib/settings/routes";

describe("user settings routes", () => {
  it("declares each section under its group in sidebar order", () => {
    expect(
      Arr.map(userSettingsSections, (section) => [
        section.href,
        section.labelKey,
        section.group.key,
      ])
    ).toEqual([
      ["/user/settings", "account", "personal"],
      ["/user/settings/subscriptions", "billing", "personal"],
      ["/user/settings/memory", "memory", "ai"],
    ]);
  });

  it("groups the sidebar by the table without repeating a section", () => {
    expect(
      Arr.map(userSettingsGroups, (group) => [
        group.key,
        Arr.map(group.sections, (section) => section.labelKey),
      ])
    ).toEqual([
      ["personal", ["account", "billing"]],
      ["ai", ["memory"]],
    ]);
  });

  it("links each group to the first section it holds", () => {
    expect(
      Arr.map(userSettingsSections, (section) => section.group.href)
    ).toEqual(["/user/settings", "/user/settings", "/user/settings/memory"]);
  });

  it("resolves each declared settings path to its own section", () => {
    expect(
      getUserSettingsSection("/user/settings/subscriptions").labelKey
    ).toBe("billing");
    expect(getUserSettingsSection("/user/settings/memory").labelKey).toBe(
      "memory"
    );
    expect(getUserSettingsSection("/user/settings").labelKey).toBe("account");
  });

  it("keeps the settings root as the owner of any undeclared settings path", () => {
    expect(getUserSettingsSection("/user/settings/unknown").labelKey).toBe(
      "account"
    );
  });

  it("recognizes only the settings surface as a settings path", () => {
    expect(isUserSettingsPath("/user/settings")).toBe(true);
    expect(isUserSettingsPath("/user/settings/subscriptions")).toBe(true);
    expect(isUserSettingsPath("/user/settings/memory")).toBe(true);
    expect(isUserSettingsPath("/user/507f1f77bcf86cd799439011")).toBe(false);
    expect(isUserSettingsPath("/user/settings-archive")).toBe(false);
  });
});
