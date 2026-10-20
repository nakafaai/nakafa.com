import type { Returns } from "@confect/core/Ref";
import type tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { BuiltinRole } from "@repo/backend/confect/access/schema";
import type { Locale } from "@repo/internationalization/src/locale";
import { Array as Arr, Option } from "effect";
import type { HomeAccess } from "@/components/tenant/home/access";
import type { Greeting } from "@/components/tenant/home/greeting";

/** The public profile of a school, as its profile query returns it. */
export type SchoolProfile = Returns<typeof tenancy.profile.get>;

/** A signed-in member's view of a school, as its viewer query returns it. */
export type SchoolViewer = Returns<typeof tenancy.viewer.get>;

/**
 * What the school layout shows for one request. The server decides it before the
 * stream starts. It holds no credential, so it crosses to the browser as route
 * context, and the browser never reads the session token.
 */
type SchoolFrame =
  | {
      readonly _tag: "Visitor";
      readonly locale: Locale;
      readonly profile: SchoolProfile;
      readonly title: string;
    }
  | {
      readonly _tag: "Outsider";
      readonly account: string;
      readonly locale: Locale;
      readonly profile: SchoolProfile;
    }
  | {
      readonly _tag: "Member";
      readonly greeting: Greeting;
      readonly home: HomeAccess;
      readonly locale: Locale;
      readonly profile: SchoolProfile;
      readonly viewer: SchoolViewer;
    };

/** The answer of the school read: the frame, or a refusal that answers the page with not found. */
export type SchoolRead = SchoolFrame | { readonly _tag: "Refused" };

/**
 * The account name of an outsider's page: the account's name, or its username
 * when the name is empty. None when neither names the account.
 */
export function readAccountName(
  name: string,
  username: string | undefined
): Option.Option<string> {
  return Option.fromUndefinedOr(name === "" ? username : name);
}

/** Whether the viewer may manage the school, which the school's settings and its setup need. */
export function canManageSchool(can: readonly string[]): boolean {
  return Arr.contains(can, "tenant.manage");
}

/** The unit that a settings page opens first: the school's first active unit, or none when no unit is active. */
export function firstActiveUnitOf<Unit extends { readonly status: string }>(
  units: readonly Unit[]
) {
  return Arr.findFirst(units, (unit) => unit.status === "active");
}

/** The first role the viewer holds in the school, or none when the viewer holds no grant. */
export function roleOf(
  grants: SchoolViewer["grants"]
): Option.Option<BuiltinRole> {
  return Option.map(Arr.head(grants), (grant) => grant.role.key);
}
