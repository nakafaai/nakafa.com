import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  getSchoolSettingsSection,
  schoolSettingsGroups,
  schoolSettingsSections,
} from "@/lib/settings/school";

describe("school settings routes", () => {
  it("declares each section under its group in sidebar order", () => {
    expect(
      Arr.map(schoolSettingsSections, (section) => [
        section.target.to,
        section.labelKey,
        section.group.key,
      ])
    ).toEqual([
      ["/school/$slug/settings/profile", "profile", "school"],
      ["/school/$slug/settings/periods", "periods", "school"],
      ["/school/$slug/settings/cohorts", "cohorts", "school"],
      ["/school/$slug/settings/units", "units", "school"],
      ["/school/$slug/settings/members", "members", "people"],
      ["/school/$slug/settings/roles", "roles", "people"],
      ["/school/$slug/settings/invites", "invites", "people"],
      ["/school/$slug/settings/students", "students", "people"],
      ["/school/$slug/settings/clients", "clients", "integrations"],
      ["/school/$slug/settings/policies", "policies", "security"],
      ["/school/$slug/settings/audit", "audit", "security"],
    ]);
  });

  it("groups the sidebar by the table without repeating a section", () => {
    expect(
      Arr.map(schoolSettingsGroups, (group) => [
        group.key,
        Arr.map(group.sections, (section) => section.labelKey),
      ])
    ).toEqual([
      ["school", ["profile", "periods", "cohorts", "units"]],
      ["people", ["members", "roles", "invites", "students"]],
      ["integrations", ["clients"]],
      ["security", ["policies", "audit"]],
    ]);
  });

  it("resolves each declared settings route to its own section", () => {
    expect(
      getSchoolSettingsSection("/school/$slug/settings/cohorts").labelKey
    ).toBe("cohorts");
    expect(
      getSchoolSettingsSection("/school/$slug/settings/audit").labelKey
    ).toBe("audit");
  });

  it("keeps the first section as the owner of the settings root and of any undeclared route", () => {
    expect(getSchoolSettingsSection("/school/$slug/settings").labelKey).toBe(
      "profile"
    );
    expect(
      getSchoolSettingsSection("/school/$slug/settings/unknown").labelKey
    ).toBe("profile");
  });
});
