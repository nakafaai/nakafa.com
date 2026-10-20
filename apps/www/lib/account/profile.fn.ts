import { POST_PAGE_SIZE } from "@repo/backend/client/posts/list";
import posts from "@repo/backend/confect/_generated/refs/posts";
import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Clock, Effect, Schema, String as Str } from "effect";
import { createTranslator } from "use-intl";
import {
  messagesFor,
  ProfileInput,
  readProfileOrNotFound,
  readToken,
} from "@/lib/account/access.server";
import type { ScreenSeo } from "@/lib/account/head";
import { preloadConfectQuery } from "@/lib/data/preload.server";
import { profileHref } from "@/lib/profile/href";
import { serverHandler } from "@/lib/server/fn";

/** A profile: the profile, whether the visitor owns it, and the layout's head. */
export const profileScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(
    serverHandler(({ locale, username }: typeof ProfileInput.Type) =>
      Effect.gen(function* () {
        const token = yield* readToken();
        const { isOwner, profile } = yield* readProfileOrNotFound(
          username,
          token
        );
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
        return { isOwner, profile, seo };
      })
    )
  );

/** The first page of a profile's posts, with the moment the server read them. */
export const profilePostsFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(
    serverHandler(({ username }: typeof ProfileInput.Type) =>
      Effect.gen(function* () {
        const token = yield* readToken();
        const { profile } = yield* readProfileOrNotFound(username, token);
        const [first, now] = yield* Effect.all(
          [
            preloadConfectQuery(
              posts.queries.list,
              {
                authorId: profile._id,
                paginationOpts: { cursor: null, numItems: POST_PAGE_SIZE },
              },
              token
            ),
            Clock.currentTimeMillis,
          ],
          { concurrency: "unbounded" }
        );
        return { first, now };
      })
    )
  );

/** The chats of a profile: the owner's alone, so anyone else gets the not-found page. */
export const profileChatScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(
    serverHandler(({ locale, username }: typeof ProfileInput.Type) =>
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
    )
  );

/** The comments of a profile: the head and the profile's owner id. */
export const profileCommentsScreenFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ProfileInput))
  .handler(
    serverHandler(({ locale, username }: typeof ProfileInput.Type) =>
      Effect.gen(function* () {
        const token = yield* readToken();
        const { profile } = yield* readProfileOrNotFound(username, token);
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
        return { seo, userId: profile._id };
      })
    )
  );
