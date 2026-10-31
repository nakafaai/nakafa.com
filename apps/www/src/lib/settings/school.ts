import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";

import { Array as Arr, Option, Schema, String as Str } from "effect";
import type { LinkTarget } from "@/lib/routing/link";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

const SchoolSettingsLabelKeySchema = Schema.Literals([
  "profile",
  "periods",
  "cohorts",
  "classes",
  "grading",
  "units",
  "billing",
  "members",
  "roles",
  "invites",
  "students",
  "roster",
  "guardians",
  "clients",
  "connections",
  "policies",
  "audit",
]);

/**
 * The action that opens each section. A section that only reads opens with the read its page needs,
 * so a role that reads the school's plans, people or records reaches them, and the page keeps its
 * buttons from whoever may not use them. Every other section opens to whoever manages the school.
 */
const SECTION_ACTIONS: Readonly<
  Partial<Record<typeof SchoolSettingsLabelKeySchema.Type, string>>
> = {
  audit: "audit.view",
  classes: "class.list",
  cohorts: "cohort.view",
  grading: "scheme.view",
  guardians: "guardian.list",
  members: "person.view",
  periods: "period.view",
  roster: "roster.view",
};

/** Whether a viewer who holds the actions in `reach` opens the section. */
const opensSection = (
  reach: readonly string[],
  labelKey: typeof SchoolSettingsLabelKeySchema.Type
) => Arr.contains(reach, SECTION_ACTIONS[labelKey] ?? "tenant.manage");

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
        "classes",
        (slug) =>
          ({
            from: LOCALE_ROUTE,
            params: { slug },
            to: "/school/$slug/settings/classes",
          }) satisfies LinkTarget
      ),
      settingsSection(
        "grading",
        (slug) =>
          ({
            from: LOCALE_ROUTE,
            params: { slug },
            to: "/school/$slug/settings/grading",
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
      settingsSection(
        "connections",
        (slug) =>
          ({
            from: LOCALE_ROUTE,
            params: { slug },
            to: "/school/$slug/settings/connections",
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

/** The groups of the sections a viewer who holds the actions in `reach` opens, in sidebar order, none of them empty. */
export function openSettingsGroups(slug: TenantSlug, reach: readonly string[]) {
  return Arr.filter(
    Arr.map(schoolSettingsGroups(slug), (group) => ({
      ...group,
      sections: Arr.filter(group.sections, (section) =>
        opensSection(reach, section.labelKey)
      ),
    })),
    (group) => group.sections.length > 0
  );
}

/** The first section a viewer opens, where the settings begin for them, or none for a viewer who opens no section. */
export function firstSettingsTarget(
  slug: TenantSlug,
  reach: readonly string[]
) {
  return Option.map(
    Arr.head(
      Arr.flatMap(openSettingsGroups(slug, reach), (group) => group.sections)
    ),
    (section) => section.target
  );
}

/**
 * Whether a viewer who holds the actions in `reach` opens the settings page of the route, by the
 * section that owns it: a section's own page and the pages below it, such as one cohort.
 */
export function opensSettingsRoute(
  slug: TenantSlug,
  reach: readonly string[],
  routeId: string
) {
  return Arr.some(openSettingsGroups(slug, reach), (group) =>
    Arr.some(group.sections, (section) =>
      Str.startsWith(`/school/$slug/settings/${section.labelKey}`)(routeId)
    )
  );
}

/** One group of the school settings, as `openSettingsGroups` returns it. */
export type SchoolSettingsGroup = ReturnType<typeof openSettingsGroups>[number];

/**
 * Every section in sidebar order, each with the group that holds it. A group
 * links to its first section the viewer opens, which is where its breadcrumb leads.
 */
export function schoolSettingsSections(
  slug: TenantSlug,
  reach: readonly string[]
) {
  const opened = openSettingsGroups(slug, reach);
  return Arr.flatMap(schoolSettingsGroups(slug), (group) => {
    const first = Arr.findFirst(opened, (open) => open.key === group.key).pipe(
      Option.flatMap((open) => Arr.head(open.sections)),
      Option.getOrElse(() => Arr.headNonEmpty(group.sections))
    );
    const parent = { key: group.key, target: first.target };

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
export function getSchoolSettingsSection(
  slug: TenantSlug,
  leafPath: string,
  reach: readonly string[]
) {
  const sections = schoolSettingsSections(slug, reach);
  return Option.getOrElse(
    Arr.findFirst(sections, (section) => section.target.to === leafPath),
    () => Arr.headNonEmpty(sections)
  );
}
