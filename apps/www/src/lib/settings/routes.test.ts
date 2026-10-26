import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  getUserSettingsSection,
  userSettingsGroups,
  userSettingsSections,
} from "@/lib/settings/routes";

describe("user settings routes", () => {
  it("declares each section under its group in sidebar order", () => {
    expect(
      Arr.map(userSettingsSections, (section) => [
        section.target.to,
        section.labelKey,
        section.group.key,
      ])
    ).toEqual([
      ["/$locale/user/settings", "account", "personal"],
      ["/$locale/user/settings/learning", "learning", "personal"],
      ["/$locale/user/settings/subscriptions", "billing", "personal"],
      ["/$locale/user/settings/memory", "memory", "ai"],
      ["/$locale/user/settings/connectors", "connectors", "ai"],
    ]);
  });

  it("groups the sidebar by the table without repeating a section", () => {
    expect(
      Arr.map(userSettingsGroups, (group) => [
        group.key,
        Arr.map(group.sections, (section) => section.labelKey),
      ])
    ).toEqual([
      ["personal", ["account", "learning", "billing"]],
      ["ai", ["memory", "connectors"]],
    ]);
  });

  it("links each group to the first section it holds", () => {
    expect(
      Arr.map(userSettingsSections, (section) => section.group.target.to)
    ).toEqual([
      "/$locale/user/settings",
      "/$locale/user/settings",
      "/$locale/user/settings",
      "/$locale/user/settings/memory",
      "/$locale/user/settings/memory",
    ]);
  });

  it("resolves each declared settings route to its own section", () => {
    expect(
      getUserSettingsSection("/$locale/user/settings/subscriptions").labelKey
    ).toBe("billing");
    expect(
      getUserSettingsSection("/$locale/user/settings/learning").labelKey
    ).toBe("learning");
    expect(
      getUserSettingsSection("/$locale/user/settings/memory").labelKey
    ).toBe("memory");
    expect(getUserSettingsSection("/$locale/user/settings").labelKey).toBe(
      "account"
    );
  });

  it("keeps the settings root as the owner of any undeclared settings route", () => {
    expect(
      getUserSettingsSection("/$locale/user/settings/unknown").labelKey
    ).toBe("account");
  });
});
