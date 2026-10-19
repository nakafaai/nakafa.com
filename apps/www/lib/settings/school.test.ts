import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  getSchoolSettingsSection,
  isExamEditorPath,
  isSchoolSettingsPath,
  schoolSettingsGroups,
  schoolSettingsSections,
} from "@/lib/settings/school";

describe("school settings routes", () => {
  it("declares each section under its group in sidebar order", () => {
    expect(
      Arr.map(schoolSettingsSections, (section) => [
        section.href,
        section.labelKey,
        section.group.key,
      ])
    ).toEqual([
      ["/settings/profile", "profile", "school"],
      ["/settings/periods", "periods", "school"],
      ["/settings/cohorts", "cohorts", "school"],
      ["/settings/units", "units", "school"],
      ["/settings/members", "members", "people"],
      ["/settings/roles", "roles", "people"],
      ["/settings/invites", "invites", "people"],
      ["/settings/students", "students", "people"],
      ["/settings/clients", "clients", "integrations"],
      ["/settings/policies", "policies", "security"],
      ["/settings/audit", "audit", "security"],
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

  it("links each group to the first section it holds", () => {
    expect(
      Arr.map(schoolSettingsSections, (section) => section.group.href)
    ).toEqual([
      "/settings/profile",
      "/settings/profile",
      "/settings/profile",
      "/settings/profile",
      "/settings/members",
      "/settings/members",
      "/settings/members",
      "/settings/members",
      "/settings/clients",
      "/settings/policies",
      "/settings/policies",
    ]);
  });

  it("resolves each declared settings path to its own section", () => {
    expect(getSchoolSettingsSection("/settings/clients").labelKey).toBe(
      "clients"
    );
    expect(getSchoolSettingsSection("/settings/audit").labelKey).toBe("audit");
    expect(getSchoolSettingsSection("/settings/profile").labelKey).toBe(
      "profile"
    );
  });

  it("keeps the first section as the owner of the settings root and of any undeclared path", () => {
    expect(getSchoolSettingsSection("/settings").labelKey).toBe("profile");
    expect(getSchoolSettingsSection("/settings/unknown").labelKey).toBe(
      "profile"
    );
  });

  it("recognizes only the school settings surface as a settings path", () => {
    expect(isSchoolSettingsPath("/settings")).toBe(true);
    expect(isSchoolSettingsPath("/settings/policies")).toBe(true);
    expect(isSchoolSettingsPath("/")).toBe(false);
    expect(isSchoolSettingsPath("/settings-archive")).toBe(false);
  });
});

describe("exam editor routes", () => {
  it("recognizes the editor route of an exam, with or without a trailing slash", () => {
    expect(isExamEditorPath("/exams/exam-1/edit")).toBe(true);
    expect(isExamEditorPath("/exams/exam-1/edit/")).toBe(true);
  });

  it("keeps the exams list, the page of one exam, and every other path out of the editor", () => {
    expect(isExamEditorPath("/exams")).toBe(false);
    expect(isExamEditorPath("/exams/exam-1")).toBe(false);
    expect(isExamEditorPath("/exams/exam-1/editor")).toBe(false);
    expect(isExamEditorPath("/settings/policies")).toBe(false);
    expect(isExamEditorPath("/")).toBe(false);
  });
});
