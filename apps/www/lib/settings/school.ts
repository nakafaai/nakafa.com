import { Array as Arr, Option, Schema } from "effect";

const SchoolSettingsSectionSchema = Schema.Struct({
  href: Schema.String,
  /** Message key owned by the `SchoolSettings` dictionary. */
  labelKey: Schema.Literals([
    "profile",
    "periods",
    "units",
    "roles",
    "invites",
    "students",
    "clients",
    "policies",
    "audit",
  ]),
});

/** The message key of one school settings section. */
export type SchoolSettingsLabelKey =
  (typeof SchoolSettingsSectionSchema.Type)["labelKey"];

/** One labelled group of addressable sections of the school settings surface. */
const SchoolSettingsGroupSchema = Schema.Struct({
  /** Message key owned by the `SchoolSettings` dictionary, which labels the group. */
  key: Schema.Literals(["school", "people", "integrations", "security"]),
  sections: Schema.NonEmptyArray(SchoolSettingsSectionSchema),
});
/** Every group of the school settings surface, in sidebar order. */
const SchoolSettingsGroupsSchema = Schema.NonEmptyArray(
  SchoolSettingsGroupSchema
);

/** Root route of the school settings surface, on a school host. */
const schoolSettingsRootHref = "/settings";

/**
 * The one table of the school settings surface: every group, in sidebar order,
 * with the sections it holds. The sidebar, the breadcrumb header, and the section
 * metadata all derive from it, so a new section has exactly one declaration.
 */
export const schoolSettingsGroups: typeof SchoolSettingsGroupsSchema.Type = [
  {
    key: "school",
    sections: [
      { href: `${schoolSettingsRootHref}/profile`, labelKey: "profile" },
      { href: `${schoolSettingsRootHref}/periods`, labelKey: "periods" },
      { href: `${schoolSettingsRootHref}/units`, labelKey: "units" },
    ],
  },
  {
    key: "people",
    sections: [
      { href: `${schoolSettingsRootHref}/roles`, labelKey: "roles" },
      { href: `${schoolSettingsRootHref}/invites`, labelKey: "invites" },
      { href: `${schoolSettingsRootHref}/students`, labelKey: "students" },
    ],
  },
  {
    key: "integrations",
    sections: [
      { href: `${schoolSettingsRootHref}/clients`, labelKey: "clients" },
    ],
  },
  {
    key: "security",
    sections: [
      { href: `${schoolSettingsRootHref}/policies`, labelKey: "policies" },
      { href: `${schoolSettingsRootHref}/audit`, labelKey: "audit" },
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
      href: Arr.headNonEmpty(group.sections).href,
      key: group.key,
    };

    return Arr.map(group.sections, (section) => ({
      ...section,
      group: parent,
    }));
  }
);

/** Returns whether one school pathname belongs to the school settings surface. */
export function isSchoolSettingsPath(pathname: string) {
  return (
    pathname === schoolSettingsRootHref ||
    pathname.startsWith(`${schoolSettingsRootHref}/`)
  );
}

/**
 * Resolves the settings section that owns one school pathname. The settings
 * root and every path this table does not declare belong to the first section,
 * so the breadcrumb is never blank.
 */
export function getSchoolSettingsSection(pathname: string) {
  return Option.getOrElse(
    Arr.findFirst(
      schoolSettingsSections,
      (section) => section.href === pathname
    ),
    () => Arr.headNonEmpty(schoolSettingsSections)
  );
}
