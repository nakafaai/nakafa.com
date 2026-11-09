import auth from "@repo/backend/confect/_generated/refs/auth";
import island from "@repo/backend/confect/_generated/refs/island";
import { growthOf } from "@repo/backend/confect/island/level";
import { Effect, Option } from "effect";
import { createTranslator } from "use-intl/core";
import {
  accountHandler,
  admitAccount,
  messagesFor,
} from "@/lib/account/access.server";
import type { ScreenSeo } from "@/lib/account/head";
import type { LocaleInput } from "@/lib/account/input";
import { readOptional } from "@/lib/data/read.server";
import { seedOf } from "@/lib/island/noise";

/**
 * The island game's screen (ADR 0047, D1): the learner's level and lifetime
 * Stars, the side of their footprint, the seed their terrain grows from, and a
 * head kept out of search. A learner with no island yet starts at level 1. The
 * island and the account go out together, so the game waits on one round trip.
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
      const lifetime = own?.lifetime ?? 0;
      const growth = growthOf(lifetime);
      const t = createTranslator({ locale, messages, namespace: "Island" });
      const seo: ScreenSeo = {
        canonicalPath: `/${locale}/island`,
        description: t("description"),
        indexable: false,
        locale,
        title: t("title"),
      };
      return {
        level: growth.level,
        lifetime,
        next: Option.getOrUndefined(growth.next),
        seed: seedOf(account?.appUser._id ?? "island"),
        seo,
        world: growth.world,
      };
    })
);
