import type { Ref } from "@confect/core";
import { CHAT_LIST_PAGE_SIZE } from "@repo/backend/client/chats/list";
import { COMMENT_PAGE_SIZE } from "@repo/backend/client/comments/list";
import { POST_PAGE_SIZE } from "@repo/backend/client/posts/list";
import auth from "@repo/backend/confect/_generated/refs/auth";
import chats from "@repo/backend/confect/_generated/refs/chats";
import comments from "@repo/backend/confect/_generated/refs/comments";
import posts from "@repo/backend/confect/_generated/refs/posts";
import progress from "@repo/backend/confect/_generated/refs/progress";
import users from "@repo/backend/confect/_generated/refs/users";
import type { Locale } from "@repo/internationalization/src/locale";
import { Clock, Effect, Option, String as Str } from "effect";
import { createTranslator } from "use-intl/core";
import {
  readAccountOptional,
  readAccountRequired,
  resolveBrowserClient,
} from "@/lib/account/client";
import type { ScreenSeo } from "@/lib/account/head";
import type { QueryClient } from "@/lib/convex/read";
import { readRenderedRouteMessages } from "@/lib/i18n/rendered";
import { profileHref } from "@/lib/profile/href";

/** One resolved profile document from `users.queries.getProfileByUsername`. */
type ProfileDoc = NonNullable<
  Ref.Returns<typeof users.queries.getProfileByUsername>
>;

/** Builds one resolved profile layout value; its return type names what child tabs reuse. */
function profileIdentity(isOwner: boolean, profile: ProfileDoc) {
  return { isOwner, profile };
}

/** The resolved parent layout data for a profile route. */
export type ProfileIdentity = ReturnType<typeof profileIdentity>;

/** Reads the profile by username and whether the current browser session owns it. */
const readProfileOnClient = Effect.fn("www.profile.readOnClient")(function* (
  client: QueryClient,
  signedIn: boolean,
  username: string
) {
  const [profileResult, account] = yield* Effect.all(
    [
      readAccountRequired(client, users.queries.getProfileByUsername, {
        username: Str.toLowerCase(username),
      }),
      signedIn
        ? readAccountOptional(
            client,
            auth.queries.getCurrentUser,
            {},
            "profile.readOptional"
          ).pipe(Effect.map(Option.fromNullishOr))
        : Effect.succeedNone,
    ],
    { concurrency: "unbounded" }
  );
  if (profileResult._tag !== "Value" || profileResult.value === null) {
    return Option.none<ProfileIdentity>();
  }
  const found = profileResult.value;
  return Option.some(
    profileIdentity(
      Option.isSome(account) && account.value.appUser._id === found._id,
      found
    )
  );
});

/** Resolves the profile identity, reusing the parent route's already-loaded value when present. */
const resolveIdentity = Effect.fn("www.profile.resolveIdentity")(function* (
  client: QueryClient,
  signedIn: boolean,
  username: string,
  known?: ProfileIdentity
) {
  if (known !== undefined) {
    return Option.some(known);
  }
  return yield* readProfileOnClient(client, signedIn, username);
});

/** Profile layout: the profile and whether the viewer owns it, read directly in the browser. */
export const readProfileScreen = Effect.fn("www.profile.screen")(function* (
  username: string,
  cookie: string
) {
  const { client, signedIn } = yield* resolveBrowserClient(cookie);
  const identity = yield* readProfileOnClient(client, signedIn, username);
  if (Option.isNone(identity)) {
    return { _tag: "NotFound" as const };
  }
  return { _tag: "Ready" as const, screen: identity.value };
});

/** Posts tab: first page of posts and head, reusing the parent profile when already loaded. */
export const readProfilePostsScreen = Effect.fn("www.profile.posts")(function* (
  locale: Locale,
  username: string,
  cookie: string,
  known?: ProfileIdentity
) {
  const { client, signedIn } = yield* resolveBrowserClient(cookie);
  const identity = yield* resolveIdentity(client, signedIn, username, known);
  if (Option.isNone(identity)) {
    return { _tag: "NotFound" as const };
  }
  const [first, messages, now] = yield* Effect.all(
    [
      readAccountOptional(
        client,
        posts.queries.list,
        {
          authorId: identity.value.profile._id,
          paginationOpts: { cursor: null, numItems: POST_PAGE_SIZE },
        },
        "profile.posts"
      ),
      Effect.promise(() =>
        readRenderedRouteMessages({ locale, namespaces: ["Auth"] })
      ),
      Clock.currentTimeMillis,
    ],
    { concurrency: "unbounded" }
  );
  const t = createTranslator({ locale, messages, namespace: "Auth" });
  const seo: ScreenSeo = {
    canonicalPath: `/${locale}${profileHref(Str.toLowerCase(username))}`,
    description: t("profile-description"),
    indexable: false,
    locale,
    title: t("profile"),
  };
  return { _tag: "Ready" as const, screen: { first, now, seo } };
});

/** Comments tab: author, first page of comments, and head in one parallel batch. */
export const readProfileCommentsScreen = Effect.fn("www.profile.comments")(
  function* (
    locale: Locale,
    username: string,
    cookie: string,
    known?: ProfileIdentity
  ) {
    const { client, signedIn } = yield* resolveBrowserClient(cookie);
    const identity = yield* resolveIdentity(client, signedIn, username, known);
    if (Option.isNone(identity)) {
      return { _tag: "NotFound" as const };
    }
    const userId = identity.value.profile._id;
    const [authorResult, first, messages] = yield* Effect.all(
      [
        readAccountRequired(client, auth.queries.getUserById, { userId }),
        readAccountOptional(
          client,
          comments.queries.getCommentsByUserId,
          {
            paginationOpts: { cursor: null, numItems: COMMENT_PAGE_SIZE },
            userId,
          },
          "profile.comments"
        ),
        Effect.promise(() =>
          readRenderedRouteMessages({ locale, namespaces: ["Auth"] })
        ),
      ],
      { concurrency: "unbounded" }
    );
    if (authorResult._tag !== "Value") {
      return { _tag: "NotFound" as const };
    }
    const t = createTranslator({ locale, messages, namespace: "Auth" });
    const seo: ScreenSeo = {
      canonicalPath: `/${locale}${profileHref(Str.toLowerCase(username))}/comments`,
      description: t("profile-description"),
      indexable: false,
      locale,
      title: t("profile"),
    };
    return {
      _tag: "Ready" as const,
      screen: { author: authorResult.value, first, seo, userId },
    };
  }
);

/** Badges tab: medals tally and head in one parallel batch. */
export const readProfileBadgesScreen = Effect.fn("www.profile.badges")(
  function* (
    locale: Locale,
    username: string,
    cookie: string,
    known?: ProfileIdentity
  ) {
    const { client, signedIn } = yield* resolveBrowserClient(cookie);
    const identity = yield* resolveIdentity(client, signedIn, username, known);
    if (Option.isNone(identity)) {
      return { _tag: "NotFound" as const };
    }
    const [medalsResult, messages] = yield* Effect.all(
      [
        readAccountRequired(client, progress.queries.medals, {
          username: identity.value.profile.username,
        }),
        Effect.promise(() =>
          readRenderedRouteMessages({ locale, namespaces: ["Auth"] })
        ),
      ],
      { concurrency: "unbounded" }
    );
    if (medalsResult._tag !== "Value" || medalsResult.value === null) {
      return { _tag: "NotFound" as const };
    }
    const t = createTranslator({ locale, messages, namespace: "Auth" });
    const seo: ScreenSeo = {
      canonicalPath: `/${locale}${profileHref(Str.toLowerCase(username))}/badges`,
      description: t("profile-description"),
      indexable: false,
      locale,
      title: t("profile"),
    };
    return {
      _tag: "Ready" as const,
      screen: { medals: medalsResult.value, seo },
    };
  }
);

/** Chat tab: owner's study chats and head; non-owners receive NotFound. */
export const readProfileChatScreen = Effect.fn("www.profile.chat")(function* (
  locale: Locale,
  username: string,
  cookie: string,
  known?: ProfileIdentity
) {
  const { client, signedIn } = yield* resolveBrowserClient(cookie);
  const identity = yield* resolveIdentity(client, signedIn, username, known);
  if (Option.isNone(identity) || !identity.value.isOwner) {
    return { _tag: "NotFound" as const };
  }
  const [first, messages, now] = yield* Effect.all(
    [
      readAccountOptional(
        client,
        chats.queries.getOwnChats,
        {
          paginationOpts: { cursor: null, numItems: CHAT_LIST_PAGE_SIZE },
          type: "study",
        },
        "profile.chat"
      ),
      Effect.promise(() =>
        readRenderedRouteMessages({ locale, namespaces: ["Auth", "Common"] })
      ),
      Clock.currentTimeMillis,
    ],
    { concurrency: "unbounded" }
  );
  const t = createTranslator({ locale, messages, namespace: "Auth" });
  const tCommon = createTranslator({ locale, messages, namespace: "Common" });
  const seo: ScreenSeo = {
    canonicalPath: `/${locale}${profileHref(Str.toLowerCase(username))}/chat`,
    description: t("chat-description"),
    indexable: false,
    locale,
    title: tCommon("chat"),
  };
  return { _tag: "Ready" as const, screen: { first, now, seo } };
});
