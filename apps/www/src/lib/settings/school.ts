import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";

import { Array as Arr, Option, Schema } from "effect";
import type { LinkTarget } from "@/lib/routing/link";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

const SchoolSettingsLabelKeySchema = Schema.Literals([
  "profile",
  "periods",
  "cohorts",
  "units",
  "billing",
  "members",
  "roles",
  "invites",
  "students",
  "roster",
  "guardians",
  "clients",
  "policies",
  "audit",
]);

/**
 * One addressable section of the school settings surface. Its message key is
 * owned by the `SchoolSettings` dictionary, and its target takes the school's
 * slug, which the settings page on screen reads from its tenant.
 */
function settingsSection(
  labelKey: typeof SchoolSettingsLabelKeySchema.Type,
  target: (slug: TenantSlug) => LinkTarget
) {
  return { labelKey, target };
}

/**
 * The one table of the school settings surface: every group, in sidebar order,
 * with the sections it holds. The sidebar, the breadcrumb header, and the section
 * metadata all derive from it, so a new section has exactly one declaration.
 */
const SCHOOL_SETTINGS_GROUPS = [
  {
    key: "school",
    sections: [
      settingsSection(
        "profile",
        (slug) =>
          ({
            from: LOCALE_ROUTE,
            params: { slug },
            to: "/school/$slug/settings/profile",
          }) satisfies LinkTarget
      ),
      settingsSection(
        "periods",
        (slug) =>
          ({
            from: LOCALE_ROUTE,
            params: { slug },
            to: "/school/$slug/settings/periods",
          }) satisfies LinkTarget
      ),
      settingsSection(
        "cohorts",
        (slug) =>
          ({
            from: LOCALE_ROUTE,
            params: { slug },
            to: "/school/$slug/settings/cohorts",
          }) satisfies LinkTarget
      ),
      settingsSection(
        "units",
        (slug) =>
          ({
            from: LOCALE_ROUTE,
            params: { slug },
            to: "/school/$slug/settings/units",
          }) satisfies LinkTarget
      ),
      settingsSection(
        "billing",
        (slug) =>
          ({
            from: LOCALE_ROUTE,
            params: { slug },
            to: "/school/$slug/settings/billing",
          }) satisfies LinkTarget
      ),
    ],
  },
  {
    key: "people",
    sections: [
      settingsSection(
        "members",
        (slug) =>
          ({
            from: LOCALE_ROUTE,
            params: { slug },
            to: "/school/$slug/settings/members",
          }) satisfies LinkTarget
      ),
      settingsSection(
        "roles",
        (slug) =>
          ({
            from: LOCALE_ROUTE,
            params: { slug },
            to: "/school/$slug/settings/roles",
          }) satisfies LinkTarget
      ),
      settingsSection(
        "invites",
        (slug) =>
          ({
            from: LOCALE_ROUTE,
            params: { slug },
            to: "/school/$slug/settings/invites",
          }) satisfies LinkTarget
      ),
      settingsSection(
        "students",
        (slug) =>
          ({
            from: LOCALE_ROUTE,
            params: { slug },
            to: "/school/$slug/settings/students",
          }) satisfies LinkTarget
      ),
      settingsSection(
        "roster",
        (slug) =>
          ({
            from: LOCALE_ROUTE,
            params: { slug },
            to: "/school/$slug/settings/roster",
          }) satisfies LinkTarget
      ),
      settingsSection(
        "guardians",
        (slug) =>
          ({
            from: LOCALE_ROUTE,
            params: { slug },
            to: "/school/$slug/settings/guardians",
          }) satisfies LinkTarget
      ),
    ],
  },
  {
    key: "integrations",
    sections: [
      settingsSection(
        "clients",
        (slug) =>
          ({
            from: LOCALE_ROUTE,
            params: { slug },
            to: "/school/$slug/settings/clients",
          }) satisfies LinkTarget
      ),
    ],
  },
  {
    key: "security",
    sections: [
      settingsSection(
        "policies",
        (slug) =>
          ({
            from: LOCALE_ROUTE,
            params: { slug },
            to: "/school/$slug/settings/policies",
          }) satisfies LinkTarget
      ),
      settingsSection(
        "audit",
        (slug) =>
          ({
            from: LOCALE_ROUTE,
            params: { slug },
            to: "/school/$slug/settings/audit",
          }) satisfies LinkTarget
      ),
    ],
  },
] as const;

/** The school's settings groups, in sidebar order, with the targets of its own slug. */
export function schoolSettingsGroups(slug: TenantSlug) {
  return Arr.map(SCHOOL_SETTINGS_GROUPS, (group) => ({
    key: group.key,
    sections: Arr.map(group.sections, (section) => ({
      labelKey: section.labelKey,
      target: section.target(slug),
    })),
  }));
}

/** One group of the school settings, as `schoolSettingsGroups` returns it. */
export type SchoolSettingsGroup = ReturnType<
  typeof schoolSettingsGroups
>[number];

/**
 * Every section in sidebar order, each with the group that holds it. A group
 * links to its first section, which is where its breadcrumb leads.
 */
export function schoolSettingsSections(slug: TenantSlug) {
  return Arr.flatMap(schoolSettingsGroups(slug), (group) => {
    const parent = {
      key: group.key,
      target: Arr.headNonEmpty(group.sections).target,
    };

    return Arr.map(group.sections, (section) => ({
      ...section,
      group: parent,
    }));
  });
}

/**
 * Resolves the settings section that owns the page on screen, given the leaf
 * route path. The settings root and every path this table does not declare
 * belong to the first section, so the breadcrumb is never blank.
 */
export function getSchoolSettingsSection(slug: TenantSlug, leafPath: string) {
  const sections = schoolSettingsSections(slug);
  return Option.getOrElse(
    Arr.findFirst(sections, (section) => section.target.to === leafPath),
    () => Arr.headNonEmpty(sections)
  );
}
