import type { Returns } from "@confect/core/Ref";
import type tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { Locale } from "@repo/internationalization/src/locale";
import { Option } from "effect";
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
