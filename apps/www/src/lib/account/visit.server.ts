import island from "@repo/backend/confect/_generated/refs/island";
import { growthOf } from "@repo/backend/confect/island/level";
import { Effect } from "effect";
import { createTranslator } from "use-intl/core";
import {
  accountHandler,
  admitAccount,
  messagesFor,
} from "@/lib/account/access.server";
import type { ScreenSeo } from "@/lib/account/head";
import type { ProfileInput } from "@/lib/account/input";
import { readOptional } from "@/lib/data/read.server";
import { seedOf } from "@/lib/island/noise";

/**
 * Another learner's island as a visitor opens it (ADR 0047, D18): its cells,
 * the seed its terrain grows from, its footprint and level, and its owner's
 * address, or none when its owner has not shared it. A head kept out of search.
 */
export const visitScreenHandler = accountHandler(
  ({ locale, username }: typeof ProfileInput.Type) =>
    Effect.gen(function* () {
      const token = yield* admitAccount(locale);
      const [visited, messages] = yield* Effect.all(
        [
          readOptional(island.queries.visit, { username }, token),
          messagesFor(locale),
        ],
        { concurrency: "unbounded" }
      );
      const t = createTranslator({ locale, messages, namespace: "Island" });
      const seo: ScreenSeo = {
        canonicalPath: `/${locale}/island/${username}`,
        description: t("description"),
        indexable: false,
        locale,
        title: t("visit-title", { name: username }),
      };
      if (visited === null) {
        return { island: null, seo, username };
      }
      const growth = growthOf(visited.lifetime);
      return {
        island: {
          edits: visited.world,
          level: growth.level,
          seed: seedOf(visited.owner),
          size: growth.size,
        },
        seo,
        username,
      };
    })
);
