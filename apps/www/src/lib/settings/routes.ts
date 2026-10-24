import { Array as Arr, Option, Schema } from "effect";
import type { LinkTarget } from "@/lib/routing/link";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

const UserSettingsLabelKeySchema = Schema.Literals([
  "account",
  "learning",
  "billing",
  "memory",
]);

/** The message key of one settings section. The `Auth` dictionary owns it. */
export type UserSettingsLabelKey = typeof UserSettingsLabelKeySchema.Type;

/** One addressable section of the private settings surface, with its typed link target. */
function userSettingsSection(
  labelKey: UserSettingsLabelKey,
  target: LinkTarget
) {
  return { labelKey, target };
}

/** One labelled group of addressable sections. The `Auth` dictionary owns its label. */
function userSettingsGroup(
  key: "ai" | "personal",
  sections: readonly [
    ReturnType<typeof userSettingsSection>,
    ...ReturnType<typeof userSettingsSection>[],
  ]
) {
  return { key, sections };
}

/**
 * The one table of the settings surface: every group, in sidebar order, with
 * the sections it holds. The sidebar, the breadcrumb header, and the section
 * metadata all derive from it, so a new section has exactly one declaration.
 */
export const userSettingsGroups = [
  userSettingsGroup("personal", [
    userSettingsSection("account", {
      from: LOCALE_ROUTE,
      to: "/$locale/user/settings",
    } satisfies LinkTarget),
    userSettingsSection("learning", {
      from: LOCALE_ROUTE,
      to: "/$locale/user/settings/learning",
    } satisfies LinkTarget),
    userSettingsSection("billing", {
      from: LOCALE_ROUTE,
      to: "/$locale/user/settings/subscriptions",
    } satisfies LinkTarget),
  ]),
  userSettingsGroup("ai", [
    userSettingsSection("memory", {
      from: LOCALE_ROUTE,
      to: "/$locale/user/settings/memory",
    } satisfies LinkTarget),
  ]),
] as const;

/**
 * Every section in sidebar order, each with the group that holds it. A group
 * links to its first section, which is where its breadcrumb leads.
 */
export const userSettingsSections = Arr.flatMap(userSettingsGroups, (group) => {
  const parent = {
    key: group.key,
    target: Arr.headNonEmpty(group.sections).target,
  };

  return Arr.map(group.sections, (section) => ({
    ...section,
    group: parent,
  }));
});

/** The first section of the surface, which the settings root and every undeclared path belong to. */
const FIRST_SECTION = (() => {
  const group = Arr.headNonEmpty(userSettingsGroups);
  const section = Arr.headNonEmpty(group.sections);
  return { ...section, group: { key: group.key, target: section.target } };
})();

/**
 * Resolves the settings section that owns the page on screen, given the leaf
 * route path of the router. The settings root owns every path this table does
 * not declare, which keeps the shell label truthful while a section is added.
 */
export function getUserSettingsSection(leafPath: string) {
  return Option.getOrElse(
    Arr.findFirst(
      userSettingsSections,
      (section) => section.target.to === leafPath
    ),
    () => FIRST_SECTION
  );
}
