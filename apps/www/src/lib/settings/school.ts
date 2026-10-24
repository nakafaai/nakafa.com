import { linkOptions } from "@tanstack/react-router";
import { Array as Arr, Option, Schema } from "effect";
import { SCHOOL_ROUTE, type SchoolLinkTarget } from "@/lib/routing/school/link";

const SchoolSettingsLabelKeySchema = Schema.Literals([
  "profile",
  "periods",
  "cohorts",
  "units",
  "members",
  "roles",
  "invites",
  "students",
  "clients",
  "policies",
  "audit",
]);

/** One addressable section of the school settings surface, with its typed link target. */
interface SchoolSettingsSection {
  /** Message key owned by the `SchoolSettings` dictionary. */
  readonly labelKey: typeof SchoolSettingsLabelKeySchema.Type;
  readonly target: SchoolLinkTarget;
}

/** One labelled group of addressable sections of the school settings surface. */
interface SchoolSettingsGroup {
  /** Message key owned by the `SchoolSettings` dictionary, which labels the group. */
  readonly key: "integrations" | "people" | "school" | "security";
  readonly sections: readonly [
    SchoolSettingsSection,
    ...SchoolSettingsSection[],
  ];
}

/**
 * The one table of the school settings surface: every group, in sidebar order,
 * with the sections it holds. The sidebar, the breadcrumb header, and the section
 * metadata all derive from it, so a new section has exactly one declaration.
 */
export const schoolSettingsGroups: readonly [
  SchoolSettingsGroup,
  ...SchoolSettingsGroup[],
] = [
  {
    key: "school",
    sections: [
      {
        labelKey: "profile",
        target: linkOptions({
          from: SCHOOL_ROUTE,
          to: "/school/$slug/settings/profile",
        }),
      },
      {
        labelKey: "periods",
        target: linkOptions({
          from: SCHOOL_ROUTE,
          to: "/school/$slug/settings/periods",
        }),
      },
      {
        labelKey: "cohorts",
        target: linkOptions({
          from: SCHOOL_ROUTE,
          to: "/school/$slug/settings/cohorts",
        }),
      },
      {
        labelKey: "units",
        target: linkOptions({
          from: SCHOOL_ROUTE,
          to: "/school/$slug/settings/units",
        }),
      },
    ],
  },
  {
    key: "people",
    sections: [
      {
        labelKey: "members",
        target: linkOptions({
          from: SCHOOL_ROUTE,
          to: "/school/$slug/settings/members",
        }),
      },
      {
        labelKey: "roles",
        target: linkOptions({
          from: SCHOOL_ROUTE,
          to: "/school/$slug/settings/roles",
        }),
      },
      {
        labelKey: "invites",
        target: linkOptions({
          from: SCHOOL_ROUTE,
          to: "/school/$slug/settings/invites",
        }),
      },
      {
        labelKey: "students",
        target: linkOptions({
          from: SCHOOL_ROUTE,
          to: "/school/$slug/settings/students",
        }),
      },
    ],
  },
  {
    key: "integrations",
    sections: [
      {
        labelKey: "clients",
        target: linkOptions({
          from: SCHOOL_ROUTE,
          to: "/school/$slug/settings/clients",
        }),
      },
    ],
  },
  {
    key: "security",
    sections: [
      {
        labelKey: "policies",
        target: linkOptions({
          from: SCHOOL_ROUTE,
          to: "/school/$slug/settings/policies",
        }),
      },
      {
        labelKey: "audit",
        target: linkOptions({
          from: SCHOOL_ROUTE,
          to: "/school/$slug/settings/audit",
        }),
      },
    ],
  },
];

/**
 * Every section in sidebar order, each with the group that holds it. A group
 * links to its first section, which is where its breadcrumb leads.
 */
export const schoolSettingsSections = Arr.flatMap(
  schoolSettingsGroups,
  (group) => {
    const parent = {
      key: group.key,
      target: Arr.headNonEmpty(group.sections).target,
    };

    return Arr.map(group.sections, (section) => ({
      ...section,
      group: parent,
    }));
  }
);

/** The first section of the school settings, which the root and every undeclared path belong to. */
const FIRST_SECTION = (() => {
  const group = Arr.headNonEmpty(schoolSettingsGroups);
  const section = Arr.headNonEmpty(group.sections);
  return { ...section, group: { key: group.key, target: section.target } };
})();

/**
 * Resolves the settings section that owns the page on screen, given the leaf
 * route path. The settings root and every path this table does not declare
 * belong to the first section, so the breadcrumb is never blank.
 */
export function getSchoolSettingsSection(leafPath: string) {
  return Option.getOrElse(
    Arr.findFirst(
      schoolSettingsSections,
      (section) => section.target.to === leafPath
    ),
    () => FIRST_SECTION
  );
}
