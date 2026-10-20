import "@tanstack/react-start/server-only";
import auth from "@repo/backend/confect/_generated/refs/auth";
import learningPreferences from "@repo/backend/confect/_generated/refs/learningPreferences";
import nina from "@repo/backend/confect/_generated/refs/nina";
import subscriptions from "@repo/backend/confect/_generated/refs/subscriptions";
import { products } from "@repo/backend/confect/customers/polar/products";
import { notFound } from "@tanstack/react-router";
import { Clock, Effect } from "effect";
import { createTranslator } from "use-intl";
import { MEMORY_PAGE } from "@/components/user/settings/memory/list";
import {
  accountHandler,
  admitAccount,
  messagesFor,
} from "@/lib/account/access.server";
import type { ScreenSeo } from "@/lib/account/head";
import type { LocaleInput } from "@/lib/account/input";
import { preloadConfectQuery } from "@/lib/data/preload.server";

/** Settings: the account, or not found when the account is gone. */
export const settingsScreenHandler = accountHandler(
  ({ locale }: typeof LocaleInput.Type) =>
    Effect.gen(function* () {
      const token = yield* admitAccount(locale);
      const account = yield* preloadConfectQuery(
        auth.queries.getCurrentUser,
        {},
        token
      );
      if (account === null) {
        return yield* Effect.die(notFound());
      }
      const t = createTranslator({
        locale,
        messages: yield* messagesFor(locale),
        namespace: "Auth",
      });
      const seo: ScreenSeo = {
        canonicalPath: `/${locale}`,
        description: t("settings-description"),
        indexable: false,
        locale,
        title: t("settings"),
      };
      return { account, seo };
    })
);

/** Learning settings: the account, the saved preference and the curriculum programs. */
export const learningScreenHandler = accountHandler(
  ({ locale }: typeof LocaleInput.Type) =>
    Effect.gen(function* () {
      const token = yield* admitAccount(locale);
      const [account, preference, programs] = yield* Effect.all(
        [
          preloadConfectQuery(auth.queries.getCurrentUser, {}, token),
          preloadConfectQuery(
            learningPreferences.queries.getCurrent,
            { locale },
            token
          ),
          preloadConfectQuery(
            learningPreferences.queries.listCurriculumPrograms,
            { locale },
            token
          ),
        ],
        { concurrency: "unbounded" }
      );
      if (account === null) {
        return yield* Effect.die(notFound());
      }
      const t = createTranslator({
        locale,
        messages: yield* messagesFor(locale),
        namespace: "Auth",
      });
      const seo: ScreenSeo = {
        canonicalPath: `/${locale}`,
        description: t("learning-description"),
        indexable: false,
        locale,
        title: t("learning"),
      };
      return { account, preference, programs, seo };
    })
);

/**
 * Memory settings: the first page of memories, whether memory is paused and the
 * moment of the read, taken after the reads as the reference takes it.
 */
export const memoryScreenHandler = accountHandler(
  ({ locale }: typeof LocaleInput.Type) =>
    Effect.gen(function* () {
      const token = yield* admitAccount(locale);
      const [first, state] = yield* Effect.all(
        [
          preloadConfectQuery(
            nina.memory.list,
            { paginationOpts: { cursor: null, numItems: MEMORY_PAGE } },
            token
          ),
          preloadConfectQuery(nina.memory.state, {}, token),
        ],
        { concurrency: "unbounded" }
      );
      if (state === null) {
        return yield* Effect.die(notFound());
      }
      const now = yield* Clock.currentTimeMillis;
      const t = createTranslator({
        locale,
        messages: yield* messagesFor(locale),
        namespace: "Auth",
      });
      const seo: ScreenSeo = {
        canonicalPath: `/${locale}`,
        description: t("memory-description"),
        indexable: false,
        locale,
        title: t("memory"),
      };
      return { first, now, paused: state.paused, seo };
    })
);

/** Subscriptions: whether the visitor holds the Pro subscription, and the page head. */
export const subscriptionsScreenHandler = accountHandler(
  ({ locale }: typeof LocaleInput.Type) =>
    Effect.gen(function* () {
      const token = yield* admitAccount(locale);
      const subscription = yield* preloadConfectQuery(
        subscriptions.queries.hasActiveSubscription,
        { productId: products.pro.id },
        token
      );
      const t = createTranslator({
        locale,
        messages: yield* messagesFor(locale),
        namespace: "Auth",
      });
      const seo: ScreenSeo = {
        canonicalPath: `/${locale}`,
        description: t("subscriptions-description"),
        indexable: false,
        locale,
        title: t("subscriptions"),
      };
      return { seo, subscription };
    })
);
