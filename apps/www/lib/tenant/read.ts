import { HttpClient } from "@confect/js";
import auth from "@repo/backend/confect/_generated/refs/auth";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import type { Locale } from "@repo/internationalization/src/locale";
import {
  Context,
  DateTime,
  Effect,
  Layer,
  Option,
  Result,
  Schema,
} from "effect";
import { homeAccess } from "@/components/tenant/home/access";
import { greetingOf } from "@/components/tenant/home/greeting";
import { httpLayer } from "@/lib/convex/http";
import { readSchoolSignInTitle } from "@/lib/tenant/copy";
import {
  readAccountName,
  type SchoolProfile,
  type SchoolRead,
  type SchoolViewer,
} from "@/lib/tenant/frame";

/** A school read that the backend did not answer: a network failure, or an answer that did not decode. */
export class SchoolReadFailed extends Schema.TaggedError<SchoolReadFailed>()(
  "SchoolReadFailed",
  { cause: Schema.Unknown }
) {}

/**
 * Why a signed-in visitor's view of a school refuses it: the school denies the
 * viewer, or the account is not a member of the school.
 */
const ViewerRefusal = Schema.Literals(["Denied", "Outsider"]);
/** The kind of a signed-in visitor's refusal, as the schema decodes it. */
type ViewerRefusalKind = typeof ViewerRefusal.Type;

/** The three backend reads that decide a school page, each with its own refusals already answered. */
export class SchoolReads extends Context.Service<
  SchoolReads,
  {
    readonly profile: (
      slug: TenantSlug
    ) => Effect.Effect<Option.Option<SchoolProfile>, SchoolReadFailed>;
    readonly viewer: (
      slug: TenantSlug,
      token: string
    ) => Effect.Effect<
      Result.Result<SchoolViewer, ViewerRefusalKind>,
      SchoolReadFailed
    >;
    readonly account: (
      token: string
    ) => Effect.Effect<Option.Option<string>, SchoolReadFailed>;
  }
>()("www/lib/tenant/read/SchoolReads") {}

/** The public profile of a school, or none when no school has the address. A visitor reads it with no token. */
const readProfile = (slug: TenantSlug) =>
  HttpClient.HttpClient.pipe(
    Effect.flatMap((client) => client.query(tenancy.profile.get, { slug })),
    Effect.asSome,
    Effect.catchTag("TenantNotFound", () => Effect.succeedNone),
    Effect.provide(httpLayer()),
    Effect.mapError((cause) => new SchoolReadFailed({ cause }))
  );

/** The viewer's view of a school for a signed-in visitor, read with the session token of the request. */
const readViewer = (slug: TenantSlug, token: string) =>
  HttpClient.HttpClient.pipe(
    Effect.flatMap((client) => client.query(tenancy.viewer.get, { slug })),
    Effect.map((viewer) => Result.succeed<SchoolViewer>(viewer)),
    Effect.catchTags({
      AccessDenied: () =>
        Effect.succeed(Result.fail<ViewerRefusalKind>("Denied")),
      NotMember: () =>
        Effect.succeed(Result.fail<ViewerRefusalKind>("Outsider")),
    }),
    Effect.provide(httpLayer({ auth: token })),
    Effect.mapError((cause) => new SchoolReadFailed({ cause }))
  );

/** The name that an outsider's page shows for its account, or none when the account has no name. */
const readAccount = (token: string) =>
  HttpClient.HttpClient.pipe(
    Effect.flatMap((client) => client.query(auth.queries.getCurrentUser)),
    Effect.map((current) =>
      Option.flatMap(Option.fromNullishOr(current), (user) =>
        readAccountName(user.appUser.name, user.appUser.username)
      )
    ),
    Effect.provide(httpLayer({ auth: token })),
    Effect.mapError((cause) => new SchoolReadFailed({ cause }))
  );

/** The live reads of the Convex deployment, each one attempt with the request's own token. */
export const SchoolReadsLive = Layer.succeed(
  SchoolReads,
  SchoolReads.of({
    account: readAccount,
    profile: readProfile,
    viewer: readViewer,
  })
);

/** The refusal that answers a school page with not found. */
const REFUSED: SchoolRead = { _tag: "Refused" };

/**
 * Decides what the school of one request shows. A school with no profile is
 * refused for every visitor, and a signed-in viewer whom the school denies is
 * refused too. A visitor gets the entry surface, and an account that is not a
 * member gets the outsider page. Any failed read fails the whole answer, so an
 * outage never looks like a missing school.
 */
export const readSchoolFrame = Effect.fn("www.tenant.readSchoolFrame")(
  function* (input: {
    readonly slug: TenantSlug;
    readonly locale: Locale;
    readonly token: Option.Option<string>;
  }) {
    const reads = yield* SchoolReads;
    const profile = yield* reads.profile(input.slug);
    if (Option.isNone(profile)) {
      return REFUSED;
    }
    const school = profile.value;
    if (Option.isNone(input.token)) {
      const title = yield* Effect.promise(() =>
        readSchoolSignInTitle(input.locale, school.name)
      );
      const visitor: SchoolRead = {
        _tag: "Visitor",
        locale: input.locale,
        profile: school,
        title,
      };
      return visitor;
    }
    const answer = yield* reads.viewer(input.slug, input.token.value);
    if (Result.isSuccess(answer)) {
      const now = yield* DateTime.now;
      const member: SchoolRead = {
        _tag: "Member",
        greeting: greetingOf(answer.success, now),
        home: homeAccess(answer.success),
        locale: input.locale,
        profile: school,
        viewer: answer.success,
      };
      return member;
    }
    if (answer.failure === "Denied") {
      return REFUSED;
    }
    const account = yield* reads.account(input.token.value);
    if (Option.isNone(account)) {
      return REFUSED;
    }
    const outsider: SchoolRead = {
      _tag: "Outsider",
      account: account.value,
      locale: input.locale,
      profile: school,
    };
    return outsider;
  }
);
