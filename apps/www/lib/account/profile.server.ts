import "@tanstack/react-start/server-only";
import { COMMENT_PAGE_SIZE } from "@repo/backend/client/comments/list";
import { POST_PAGE_SIZE } from "@repo/backend/client/posts/list";
import comments from "@repo/backend/confect/_generated/refs/comments";
import posts from "@repo/backend/confect/_generated/refs/posts";
import { notFound } from "@tanstack/react-router";
import { Clock, Effect, String as Str } from "effect";
import { createTranslator } from "use-intl";
import {
  accountHandler,
  messagesFor,
  readProfileOrNotFound,
  readToken,
} from "@/lib/account/access.server";
import type { ScreenSeo } from "@/lib/account/head";
import type { ProfileInput } from "@/lib/account/input";
import { readOptional } from "@/lib/data/read.server";
import { profileHref } from "@/lib/profile/href";

/** A profile: the profile and whether the visitor owns it. The layout's head is robots only. */
export const profileScreenHandler = accountHandler(
  ({ username }: typeof ProfileInput.Type) =>
    Effect.gen(function* () {
      const token = yield* readToken();
      return yield* readProfileOrNotFound(username, token);
    })
);

/**
 * The Posts tab: the first page of a profile's posts, the moment the server read
 * them, and the tab's head. A posts page the viewer may not read is left to the
 * live list; a real failure fails the page.
 */
export const profilePostsHandler = accountHandler(
  ({ locale, username }: typeof ProfileInput.Type) =>
    Effect.gen(function* () {
      const token = yield* readToken();
      const { profile } = yield* readProfileOrNotFound(username, token);
      const first = yield* readOptional(
        posts.queries.list,
        {
          authorId: profile._id,
          paginationOpts: { cursor: null, numItems: POST_PAGE_SIZE },
        },
        token
      );
      const now = yield* Clock.currentTimeMillis;
      const t = createTranslator({
        locale,
        messages: yield* messagesFor(locale),
        namespace: "Auth",
      });
      const seo: ScreenSeo = {
        canonicalPath: `/${locale}${profileHref(Str.toLowerCase(username))}`,
        description: t("profile-description"),
        indexable: false,
        locale,
        title: t("profile"),
      };
      return { first, now, seo };
    })
);

/** The chats of a profile: the owner's alone, so anyone else gets the not-found page. */
export const profileChatHandler = accountHandler(
  ({ locale, username }: typeof ProfileInput.Type) =>
    Effect.gen(function* () {
      const token = yield* readToken();
      const { isOwner, profile } = yield* readProfileOrNotFound(
        username,
        token
      );
      if (!isOwner) {
        return yield* Effect.die(notFound());
      }
      const t = createTranslator({
        locale,
        messages: yield* messagesFor(locale),
        namespace: "Auth",
      });
      const seo: ScreenSeo = {
        canonicalPath: `/${locale}${profileHref(Str.toLowerCase(username))}/chat`,
        description: t("chat-description"),
        indexable: false,
        locale,
        title: t("chat"),
      };
      return { seo, userId: profile._id };
    })
);

/**
 * The Comments tab: the first page of a profile's comments, the tab's head and the
 * profile's owner id.
 */
export const profileCommentsHandler = accountHandler(
  ({ locale, username }: typeof ProfileInput.Type) =>
    Effect.gen(function* () {
      const token = yield* readToken();
      const { profile } = yield* readProfileOrNotFound(username, token);
      const first = yield* readOptional(
        comments.queries.getCommentsByUserId,
        {
          paginationOpts: { cursor: null, numItems: COMMENT_PAGE_SIZE },
          userId: profile._id,
        },
        token
      );
      const t = createTranslator({
        locale,
        messages: yield* messagesFor(locale),
        namespace: "Auth",
      });
      const seo: ScreenSeo = {
        canonicalPath: `/${locale}${profileHref(Str.toLowerCase(username))}/comments`,
        description: t("profile-description"),
        indexable: false,
        locale,
        title: t("profile"),
      };
      return { first, seo, userId: profile._id };
    })
);
