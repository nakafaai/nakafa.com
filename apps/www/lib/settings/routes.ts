import { HeartAddIcon, UserIcon } from "@hugeicons/core-free-icons";
import { Schema } from "effect";

const UserSettingsSectionSchema = Schema.Struct({
  href: Schema.String,
  /** The Hugeicons SVG tree that `HugeIcons` renders for the section. */
  icon: Schema.Array(
    Schema.Tuple([
      Schema.String,
      Schema.Record(
        Schema.String,
        Schema.Union([Schema.String, Schema.Finite])
      ),
    ])
  ),
  /** Message key owned by the `Auth` dictionary. */
  labelKey: Schema.Literals(["account", "billing"]),
});
/** One addressable section of the private user settings surface. */
export type UserSettingsSection = typeof UserSettingsSectionSchema.Type;

/** Root route of the private settings surface. */
const userSettingsRootHref = "/user/settings";

/**
 * Ordered settings sections consumed by the sidebar, the breadcrumb header, and
 * the section metadata, so a new section has exactly one declaration.
 */
export const userSettingsSections = [
  {
    href: userSettingsRootHref,
    icon: UserIcon,
    labelKey: "account",
  },
  {
    href: `${userSettingsRootHref}/subscriptions`,
    icon: HeartAddIcon,
    labelKey: "billing",
  },
] as const satisfies readonly UserSettingsSection[];

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
export function getUserSettingsSection(pathname: string): UserSettingsSection {
  return (
    userSettingsSections.find((section) => section.href === pathname) ??
    userSettingsSections[0]
  );
}
