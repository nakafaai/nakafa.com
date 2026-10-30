import auth from "@repo/backend/confect/_generated/refs/auth";
import billing from "@repo/backend/confect/_generated/refs/billing";
import learningPreferences from "@repo/backend/confect/_generated/refs/learningPreferences";
import nina from "@repo/backend/confect/_generated/refs/nina";
import { getPlanCreditConfig } from "@repo/backend/confect/credits/constants";
import { notFound } from "@tanstack/react-router";
import { Clock, Effect } from "effect";
import { createTranslator } from "use-intl/core";
import { MEMORY_PAGE } from "@/components/user/settings/memory/list";
import {
  accountHandler,
  admitAccount,
  messagesFor,
} from "@/lib/account/access.server";
import type { ScreenSeo } from "@/lib/account/head";
import type { LocaleInput } from "@/lib/account/input";
import { readOptional, readRequired } from "@/lib/data/read.server";

/** Settings: the account, or not found when the account is gone. */
export const settingsScreenHandler = accountHandler(
  ({ locale }: typeof LocaleInput.Type) =>
    Effect.gen(function* () {
      const token = yield* admitAccount(locale);
      const account = yield* readRequired(
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
          readRequired(auth.queries.getCurrentUser, {}, token),
          readOptional(
            learningPreferences.queries.getCurrent,
            { locale },
            token
          ),
          readRequired(
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
          readRequired(
            nina.memory.list,
            { paginationOpts: { cursor: null, numItems: MEMORY_PAGE } },
            token
          ),
          readRequired(nina.memory.state, {}, token),
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

/** Connector settings: the page head; the page reads its connections live. */
export const connectorsScreenHandler = accountHandler(
  ({ locale }: typeof LocaleInput.Type) =>
    Effect.gen(function* () {
      yield* admitAccount(locale);
      const t = createTranslator({
        locale,
        messages: yield* messagesFor(locale),
        namespace: "Auth",
      });
      const seo: ScreenSeo = {
        canonicalPath: `/${locale}`,
        description: t("connectors-description"),
        indexable: false,
        locale,
        title: t("connectors"),
      };
      return { seo };
    })
);

/** Billing settings: the viewer's billing overview, and the page head. */
export const subscriptionsScreenHandler = accountHandler(
  ({ locale }: typeof LocaleInput.Type) =>
    Effect.gen(function* () {
      const token = yield* admitAccount(locale);
      const overview = yield* readRequired(billing.queries.overview, {}, token);
      const t = createTranslator({
        locale,
        messages: yield* messagesFor(locale),
        namespace: "Auth",
      });
      const seo: ScreenSeo = {
        canonicalPath: `/${locale}`,
        description: t("subscriptions-description", {
          credits: getPlanCreditConfig("pro").amount,
        }),
        indexable: false,
        locale,
        title: t("subscriptions"),
      };
      return { overview, seo };
    })
);
