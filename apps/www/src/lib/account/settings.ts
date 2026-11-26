import auth from "@repo/backend/confect/_generated/refs/auth";
import billing from "@repo/backend/confect/_generated/refs/billing";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import learningPreferences from "@repo/backend/confect/_generated/refs/learningPreferences";
import nina from "@repo/backend/confect/_generated/refs/nina";
import { getPlanCreditConfig } from "@repo/backend/confect/credits/constants";
import type { Locale } from "@repo/internationalization/src/locale";
import { Clock, Effect, Option } from "effect";
import { createTranslator } from "use-intl/core";
import { CONNECTION_PAGE_SIZE } from "@/components/connectors/optimistic";
import { MEMORY_PAGE } from "@/components/user/settings/memory/list";
import {
  readAccountOptional,
  readAccountRequired,
  resolveAccountClient,
} from "@/lib/account/client";
import type { ScreenSeo } from "@/lib/account/head";
import { readRenderedRouteMessages } from "@/lib/i18n/rendered";

/** Account settings: the signed-in account and head, read directly in the browser. */
export const readSettingsScreen = Effect.fn("www.settings.read")(function* (
  locale: Locale,
  origin: string
) {
  const clientOption = yield* resolveAccountClient(origin);
  if (Option.isNone(clientOption)) {
    return { _tag: "SignedOut" as const };
  }
  const client = clientOption.value;
  const [accountResult, messages] = yield* Effect.all(
    [
      readAccountRequired(client, auth.queries.getCurrentUser, {}),
      Effect.promise(() =>
        readRenderedRouteMessages({ locale, namespaces: ["Auth", "Common"] })
      ),
    ],
    { concurrency: "unbounded" }
  );
  if (accountResult._tag !== "Value") {
    return accountResult;
  }
  if (accountResult.value === null) {
    return { _tag: "NotFound" as const };
  }
  const t = createTranslator({ locale, messages, namespace: "Auth" });
  const tCommon = createTranslator({ locale, messages, namespace: "Common" });
  const seo: ScreenSeo = {
    canonicalPath: `/${locale}`,
    description: t("settings-description"),
    indexable: false,
    locale,
    title: tCommon("settings"),
  };
  return {
    _tag: "Ready" as const,
    screen: { account: accountResult.value, seo },
  };
});

/** Learning settings: the account, saved preference, and curriculum programs in one parallel batch. */
export const readLearningScreen = Effect.fn("www.settings.learning")(function* (
  locale: Locale,
  origin: string
) {
  const clientOption = yield* resolveAccountClient(origin);
  if (Option.isNone(clientOption)) {
    return { _tag: "SignedOut" as const };
  }
  const client = clientOption.value;
  const [accountResult, preference, programsResult, messages] =
    yield* Effect.all(
      [
        readAccountRequired(client, auth.queries.getCurrentUser, {}),
        readAccountOptional(
          client,
          learningPreferences.queries.getCurrent,
          { locale },
          "settings.learning"
        ),
        readAccountRequired(
          client,
          learningPreferences.queries.listCurriculumPrograms,
          { locale }
        ),
        Effect.promise(() =>
          readRenderedRouteMessages({ locale, namespaces: ["Auth"] })
        ),
      ],
      { concurrency: "unbounded" }
    );
  if (accountResult._tag !== "Value") {
    return accountResult;
  }
  if (programsResult._tag !== "Value") {
    return programsResult;
  }
  if (accountResult.value === null) {
    return { _tag: "NotFound" as const };
  }
  const t = createTranslator({ locale, messages, namespace: "Auth" });
  const seo: ScreenSeo = {
    canonicalPath: `/${locale}`,
    description: t("learning-description"),
    indexable: false,
    locale,
    title: t("section.learning"),
  };
  return {
    _tag: "Ready" as const,
    screen: {
      account: accountResult.value,
      preference,
      programs: programsResult.value,
      seo,
    },
  };
});

/** Memory settings: first page of memories, pause state, and read clock in one parallel batch. */
export const readMemoryScreen = Effect.fn("www.settings.memory")(function* (
  locale: Locale,
  origin: string
) {
  const clientOption = yield* resolveAccountClient(origin);
  if (Option.isNone(clientOption)) {
    return { _tag: "SignedOut" as const };
  }
  const client = clientOption.value;
  const [firstResult, stateResult, messages, now] = yield* Effect.all(
    [
      readAccountRequired(client, nina.memory.list, {
        paginationOpts: { cursor: null, numItems: MEMORY_PAGE },
      }),
      readAccountRequired(client, nina.memory.state, {}),
      Effect.promise(() =>
        readRenderedRouteMessages({ locale, namespaces: ["Auth"] })
      ),
      Clock.currentTimeMillis,
    ],
    { concurrency: "unbounded" }
  );
  if (firstResult._tag !== "Value") {
    return firstResult;
  }
  if (stateResult._tag !== "Value") {
    return stateResult;
  }
  if (stateResult.value === null) {
    return { _tag: "NotFound" as const };
  }
  const t = createTranslator({ locale, messages, namespace: "Auth" });
  const seo: ScreenSeo = {
    canonicalPath: `/${locale}`,
    description: t("memory-description"),
    indexable: false,
    locale,
    title: t("section.memory"),
  };
  return {
    _tag: "Ready" as const,
    screen: {
      first: firstResult.value,
      now,
      paused: stateResult.value.paused,
      seo,
    },
  };
});

/** Connector settings: first connections and offered Google connectors in one parallel batch. */
export const readConnectorsScreen = Effect.fn("www.settings.connectors")(
  function* (locale: Locale, origin: string) {
    const clientOption = yield* resolveAccountClient(origin);
    if (Option.isNone(clientOption)) {
      return { _tag: "SignedOut" as const };
    }
    const client = clientOption.value;
    const [firstResult, offeredResult, messages] = yield* Effect.all(
      [
        readAccountRequired(client, connectors.connections.listOwn, {
          paginationOpts: { cursor: null, numItems: CONNECTION_PAGE_SIZE },
        }),
        readAccountRequired(client, connectors.google.offered, {}),
        Effect.promise(() =>
          readRenderedRouteMessages({ locale, namespaces: ["Auth"] })
        ),
      ],
      { concurrency: "unbounded" }
    );
    if (firstResult._tag !== "Value") {
      return firstResult;
    }
    if (offeredResult._tag !== "Value") {
      return offeredResult;
    }
    const t = createTranslator({ locale, messages, namespace: "Auth" });
    const seo: ScreenSeo = {
      canonicalPath: `/${locale}`,
      description: t("connectors-description"),
      indexable: false,
      locale,
      title: t("section.connectors"),
    };
    return {
      _tag: "Ready" as const,
      screen: {
        first: firstResult.value,
        offered: offeredResult.value,
        seo,
      },
    };
  }
);

/** Billing settings: the viewer's billing overview and page head in one parallel batch. */
export const readSubscriptionsScreen = Effect.fn("www.settings.subscriptions")(
  function* (locale: Locale, origin: string) {
    const clientOption = yield* resolveAccountClient(origin);
    if (Option.isNone(clientOption)) {
      return { _tag: "SignedOut" as const };
    }
    const client = clientOption.value;
    const [overviewResult, messages] = yield* Effect.all(
      [
        readAccountRequired(client, billing.queries.overview, {}),
        Effect.promise(() =>
          readRenderedRouteMessages({ locale, namespaces: ["Auth"] })
        ),
      ],
      { concurrency: "unbounded" }
    );
    if (overviewResult._tag !== "Value") {
      return overviewResult;
    }
    const t = createTranslator({ locale, messages, namespace: "Auth" });
    const seo: ScreenSeo = {
      canonicalPath: `/${locale}`,
      description: t("subscriptions-description", {
        credits: getPlanCreditConfig("pro").amount,
      }),
      indexable: false,
      locale,
      title: t("subscriptions"),
    };
    return {
      _tag: "Ready" as const,
      screen: { overview: overviewResult.value, seo },
    };
  }
);
