import { Array as Arr, Option, Schema } from "effect";

const UserSettingsSectionSchema = Schema.Struct({
  href: Schema.String,
  /** Message key owned by the `Auth` dictionary. */
  labelKey: Schema.Literals(["account", "billing", "memory"]),
});

/** The message key of one settings section. */
export type UserSettingsLabelKey =
  (typeof UserSettingsSectionSchema.Type)["labelKey"];

/** One labelled group of addressable sections of the private settings surface. */
const UserSettingsGroupSchema = Schema.Struct({
  /** Message key owned by the `Auth` dictionary, which labels the group. */
  key: Schema.Literals(["personal", "ai"]),
  sections: Schema.NonEmptyArray(UserSettingsSectionSchema),
});
/** Every group of the settings surface, in sidebar order. */
const UserSettingsGroupsSchema = Schema.NonEmptyArray(UserSettingsGroupSchema);

/** Root route of the private settings surface. */
const userSettingsRootHref = "/user/settings";

/**
 * The one table of the settings surface: every group, in sidebar order, with
 * the sections it holds. The sidebar, the breadcrumb header, and the section
 * metadata all derive from it, so a new section has exactly one declaration.
 */
export const userSettingsGroups: typeof UserSettingsGroupsSchema.Type = [
  {
    key: "personal",
    sections: [
      {
        href: userSettingsRootHref,
        labelKey: "account",
      },
      {
        href: `${userSettingsRootHref}/subscriptions`,
        labelKey: "billing",
      },
    ],
  },
  {
    key: "ai",
    sections: [
      {
        href: `${userSettingsRootHref}/memory`,
        labelKey: "memory",
      },
    ],
  },
];

/**
 * Every section in sidebar order, each with the group that holds it. A group
 * links to its first section, which is where its breadcrumb leads.
 */
export const userSettingsSections = Arr.flatMap(userSettingsGroups, (group) => {
  const parent = {
    href: Arr.headNonEmpty(group.sections).href,
    key: group.key,
  };

  return Arr.map(group.sections, (section) => ({
    ...section,
    group: parent,
  }));
});

/** Returns whether one app pathname belongs to the private settings surface. */
export function isUserSettingsPath(pathname: string) {
  return (
    pathname === userSettingsRootHref ||
    pathname.startsWith(`${userSettingsRootHref}/`)
  );
}

/**
 * Resolves the settings section that owns one settings pathname.
 *
 * The settings root owns every path this table does not declare, which keeps
 * the shell label truthful instead of blank while a section is being added.
 */
export function getUserSettingsSection(pathname: string) {
  return Option.getOrElse(
    Arr.findFirst(userSettingsSections, (section) => section.href === pathname),
    () => Arr.headNonEmpty(userSettingsSections)
  );
}
