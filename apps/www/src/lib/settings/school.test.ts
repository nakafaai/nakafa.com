import { describe, expect, it } from "@effect/vitest";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option, Schema } from "effect";
import {
  firstSettingsTarget,
  getSchoolSettingsSection,
  openSettingsGroups,
  opensSettingsRoute,
  schoolSettingsGroups,
  schoolSettingsSections,
} from "@/lib/settings/school";

const slug = Schema.decodeSync(TenantSlug)("harapan");

/** What an Admin's roles open: every section. */
const ADMIN = [
  "audit.view",
  "class.list",
  "cohort.view",
  "guardian.list",
  "period.view",
  "person.view",
  "roster.view",
  "scheme.view",
  "tenant.manage",
];

/** What a Deputy principal's roles open: the school's plans and people, and no manager's section. */
const DEPUTY = ["class.list", "cohort.view", "period.view", "person.view"];

describe("school settings routes", () => {
  it("declares each section under its group in sidebar order", () => {
    expect(
      Arr.map(schoolSettingsSections(slug, ADMIN), (section) => [
        section.target.to,
        section.labelKey,
        section.group.key,
      ])
    ).toEqual([
      ["/school/$slug/settings/profile", "profile", "school"],
      ["/school/$slug/settings/periods", "periods", "school"],
      ["/school/$slug/settings/cohorts", "cohorts", "school"],
      ["/school/$slug/settings/classes", "classes", "school"],
      ["/school/$slug/settings/grading", "grading", "school"],
      ["/school/$slug/settings/units", "units", "school"],
      ["/school/$slug/settings/billing", "billing", "school"],
      ["/school/$slug/settings/members", "members", "people"],
      ["/school/$slug/settings/roles", "roles", "people"],
      ["/school/$slug/settings/invites", "invites", "people"],
      ["/school/$slug/settings/students", "students", "people"],
      ["/school/$slug/settings/roster", "roster", "people"],
      ["/school/$slug/settings/guardians", "guardians", "people"],
      ["/school/$slug/settings/clients", "clients", "integrations"],
      ["/school/$slug/settings/connections", "connections", "integrations"],
      ["/school/$slug/settings/policies", "policies", "security"],
      ["/school/$slug/settings/audit", "audit", "security"],
    ]);
  });

  it("groups the sidebar by the table without repeating a section", () => {
    expect(
      Arr.map(schoolSettingsGroups(slug), (group) => [
        group.key,
        Arr.map(group.sections, (section) => section.labelKey),
      ])
    ).toEqual([
      [
        "school",
        [
          "profile",
          "periods",
          "cohorts",
          "classes",
          "grading",
          "units",
          "billing",
        ],
      ],
      [
        "people",
        ["members", "roles", "invites", "students", "roster", "guardians"],
      ],
      ["integrations", ["clients", "connections"]],
      ["security", ["policies", "audit"]],
    ]);
  });

  it("links each group to the first section it holds", () => {
    expect(
      Arr.map(
        schoolSettingsSections(slug, ADMIN),
        (section) => section.group.target.to
      )
    ).toEqual([
      "/school/$slug/settings/profile",
      "/school/$slug/settings/profile",
      "/school/$slug/settings/profile",
      "/school/$slug/settings/profile",
      "/school/$slug/settings/profile",
      "/school/$slug/settings/profile",
      "/school/$slug/settings/profile",
      "/school/$slug/settings/members",
      "/school/$slug/settings/members",
      "/school/$slug/settings/members",
      "/school/$slug/settings/members",
      "/school/$slug/settings/members",
      "/school/$slug/settings/members",
      "/school/$slug/settings/clients",
      "/school/$slug/settings/clients",
      "/school/$slug/settings/policies",
      "/school/$slug/settings/policies",
    ]);
  });

  it("resolves each declared settings route to its own section", () => {
    expect(
      getSchoolSettingsSection(slug, "/school/$slug/settings/cohorts", ADMIN)
        .labelKey
    ).toBe("cohorts");
    expect(
      getSchoolSettingsSection(slug, "/school/$slug/settings/audit", ADMIN)
        .labelKey
    ).toBe("audit");
  });

  it("keeps the first section as the owner of the settings root and of any undeclared route", () => {
    expect(
      getSchoolSettingsSection(slug, "/school/$slug/settings", ADMIN).labelKey
    ).toBe("profile");
    expect(
      getSchoolSettingsSection(slug, "/school/$slug/settings/unknown", ADMIN)
        .labelKey
    ).toBe("profile");
  });

  it("opens a role only the sections its actions reach, and drops a group it reaches nothing of", () => {
    expect(
      Arr.map(openSettingsGroups(slug, DEPUTY), (group) => [
        group.key,
        Arr.map(group.sections, (section) => section.labelKey),
      ])
    ).toEqual([
      ["school", ["periods", "cohorts", "classes"]],
      ["people", ["members"]],
    ]);
    expect(openSettingsGroups(slug, ["audit.view"])).toMatchObject([
      { key: "security", sections: [{ labelKey: "audit" }] },
    ]);
  });

  it("begins the settings at a viewer's first open section, and at none for a viewer who opens none", () => {
    expect(
      Option.map(firstSettingsTarget(slug, ADMIN), (target) => target.to)
    ).toEqual(Option.some("/school/$slug/settings/profile"));
    expect(
      Option.map(firstSettingsTarget(slug, DEPUTY), (target) => target.to)
    ).toEqual(Option.some("/school/$slug/settings/periods"));
    expect(Option.isNone(firstSettingsTarget(slug, []))).toBe(true);
  });

  it("opens a section's own page and the pages below it, and no section the viewer does not reach", () => {
    expect(
      opensSettingsRoute(slug, DEPUTY, "/school/$slug/settings/cohorts/$cohort")
    ).toBe(true);
    expect(
      opensSettingsRoute(slug, DEPUTY, "/school/$slug/settings/roles")
    ).toBe(false);
  });

  it("links a group to the first section the viewer opens in it", () => {
    const members = getSchoolSettingsSection(
      slug,
      "/school/$slug/settings/members",
      DEPUTY
    );
    const audit = getSchoolSettingsSection(
      slug,
      "/school/$slug/settings/audit",
      DEPUTY
    );
    expect(members.group.target.to).toBe("/school/$slug/settings/members");
    expect(audit.group.target.to).toBe("/school/$slug/settings/policies");
  });
});
