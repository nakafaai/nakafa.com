import auth from "@repo/backend/confect/_generated/refs/auth";
import island from "@repo/backend/confect/_generated/refs/island";
import { Effect } from "effect";
import { createTranslator } from "use-intl/core";
import {
  accountHandler,
  admitAccount,
  messagesFor,
} from "@/lib/account/access.server";
import type { ScreenSeo } from "@/lib/account/head";
import type { LocaleInput } from "@/lib/account/input";
import { readOptional } from "@/lib/data/read.server";
import { entryOf } from "@/lib/island/entry";

/**
 * The island game's screen (ADR 0047, D1 and D6): the learner's level and
 * lifetime Stars, the side of their footprint, the seed their terrain grows
 * from, the cells they changed and the version of those edits, and a head
 * kept out of search. A learner with no island yet starts at level 1 with
 * nothing changed. The island and the account go out together, so the game
 * waits on one round trip.
 */
export const islandScreenHandler = accountHandler(
  ({ locale }: typeof LocaleInput.Type) =>
    Effect.gen(function* () {
      const token = yield* admitAccount(locale);
      const [own, messages, account] = yield* Effect.all(
        [
          readOptional(island.queries.own, {}, token),
          messagesFor(locale),
          readOptional(auth.queries.getCurrentUser, {}, token),
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
