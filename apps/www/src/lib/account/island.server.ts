import auth from "@repo/backend/confect/_generated/refs/auth";
import island from "@repo/backend/confect/_generated/refs/island";
import { notFound } from "@tanstack/react-router";
import { Effect } from "effect";
import { createTranslator } from "use-intl/core";
import {
  accountHandler,
  admitAccount,
  messagesFor,
  readToken,
} from "@/lib/account/access.server";
import type { ScreenSeo } from "@/lib/account/head";
import type { LocaleInput, ProfileInput } from "@/lib/account/input";
import { readRequired } from "@/lib/data/read.server";
import { entryOf } from "@/lib/island/entry";

/**
 * The world game's screen (ADR 0047, D1; ADR 0050, W1 and W5): the learner's
 * level and lifetime Stars, the blueprints they opened, what their land's
 * seed is made from, and a head kept out of search. A learner with no island
 * yet starts at level 1 with nothing opened. The island and the account go
 * out together, so the game waits on one round trip; what the learner changed
 * on their land is read by the game itself, region by region.
 */
export const islandScreenHandler = accountHandler(
  ({ locale }: typeof LocaleInput.Type) =>
    Effect.gen(function* () {
      const token = yield* admitAccount(locale);
      const [own, messages, account] = yield* Effect.all(
        [
          readRequired(island.queries.own, {}, token),
          messagesFor(locale),
          readRequired(auth.queries.getCurrentUser, {}, token),
        ],
        { concurrency: "unbounded" }
      );
      const t = createTranslator({ locale, messages, namespace: "Island" });
      const seo: ScreenSeo = {
        canonicalPath: `/${locale}/island`,
        description: t("description"),
        indexable: false,
        locale,
        title: t("title"),
      };
      return {
        ...entryOf(own, account?.appUser._id),
        seo,
      };
    })
);

/**
 * A visit to another learner's world (ADR 0050, W6): whose it is, their level
 * and what their land's seed is made from, for whoever the world opens to,
 * with or without an account, and a head kept out of search. A name nobody
 * holds and a world that does not open to the visitor both get the not-found
 * page, so an address tells a stranger nothing.
 */
export const worldScreenHandler = accountHandler(
  ({ locale, username }: typeof ProfileInput.Type) =>
    Effect.gen(function* () {
      const token = yield* readToken();
      const [visit, messages] = yield* Effect.all(
        [
          readRequired(island.queries.visit, { username }, token),
          messagesFor(locale),
        ],
        { concurrency: "unbounded" }
      );
      if (visit === null) {
        return yield* Effect.die(notFound());
      }
      const t = createTranslator({ locale, messages, namespace: "Island" });
      const seo: ScreenSeo = {
        canonicalPath: `/${locale}/island/${username}`,
        description: t("description"),
        indexable: false,
        locale,
        title: t("title"),
      };
      return { ...visit, seo, username };
    })
);
