import type { BuiltinRole } from "@repo/backend/confect/access/schema";
import { TenantProfile } from "@repo/backend/confect/tenancy/schema";
import { ViewerView } from "@repo/backend/confect/tenancy/viewer.spec";
import { LocaleSchema } from "@repo/internationalization/src/locale";
import { Array as Arr, Option, Schema } from "effect";
import { HomeAccessSchema } from "@/components/tenant/home/access";
import { GreetingSchema } from "@/components/tenant/home/greeting";

/** The public profile of a school, as its profile query returns it. */
export type SchoolProfile = typeof TenantProfile.Type;

/** A signed-in member's view of a school, as its viewer query returns it. */
export type SchoolViewer = typeof ViewerView.Type;

/**
 * What the school layout shows a visitor with no session: the entry surface of a school
 * that has a profile. A visitor's page holds no account, so it carries only the title.
 */
const VisitorFrame = Schema.TaggedStruct("Visitor", {
  locale: LocaleSchema,
  profile: TenantProfile,
  title: Schema.String,
});

/** What the school layout shows an account that is signed in but is not a member. */
const OutsiderFrame = Schema.TaggedStruct("Outsider", {
  account: Schema.String,
  locale: LocaleSchema,
  profile: TenantProfile,
});

/**
 * What the school layout shows a member: the shell, its greeting, and what the viewer may do with
 * exams. The shell's context carries it to every page of the school.
 */
const MemberFrame = Schema.TaggedStruct("Member", {
  greeting: GreetingSchema,
  home: HomeAccessSchema,
  locale: LocaleSchema,
  profile: TenantProfile,
  viewer: ViewerView,
});

/**
 * What the school layout shows for one request. The server decides it before the
 * stream starts. It holds no credential, so it crosses to the browser as route
 * context, and the browser never reads the session token.
 */
const SchoolFrameSchema = Schema.Union([
  VisitorFrame,
  OutsiderFrame,
  MemberFrame,
]);

/** The frame of one request, as the school layout renders it. */
type SchoolFrame = typeof SchoolFrameSchema.Type;

/** The refusal that answers a school page with not found. */
const RefusedRead = Schema.TaggedStruct("Refused", {});

/** The answer of the school read: the frame, or a refusal that answers the page with not found. */
export type SchoolRead = SchoolFrame | typeof RefusedRead.Type;

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

/**
 * The outsider frame that a reload answers once the school stops counting a member: the member's
 * own account and the school's profile, as the server builds that frame. A frame that is not a
 * member's has none, and so has an account with no name, for which a reload answers not found.
 */
export function outsiderOf(
  frame: SchoolRead
): Option.Option<typeof OutsiderFrame.Type> {
  if (frame._tag !== "Member") {
    return Option.none();
  }
  return Option.map(
    readAccountName(frame.viewer.account.name, frame.viewer.account.username),
    (account) => ({
      _tag: "Outsider" as const,
      account,
      locale: frame.locale,
      profile: frame.profile,
    })
  );
}

/** Whether the viewer may manage the school, which the school's settings and its setup need. */
export function canManageSchool(can: readonly string[]): boolean {
  return Arr.contains(can, "tenant.manage");
}

/** The first role the viewer holds in the school, or none when the viewer holds no grant. */
export function roleOf(
  grants: SchoolViewer["grants"]
): Option.Option<BuiltinRole> {
  return Option.map(Arr.head(grants), (grant) => grant.role.key);
}
