import "@tanstack/react-start/server-only";

import { Effect } from "effect";
import { readFeaturedTryout } from "@/components/tryout/catalog/server";
import {
  readRuntimeCurriculumCatalog,
  readRuntimeCurriculumOptions,
} from "@/lib/curriculum/model";
import type { HomeInput } from "@/lib/marketing/home.fn";
import { serverHandler } from "@/lib/server/fn";

/** Reads the featured try-out of the home page for one locale from the tagged content cache. */
const readHomeTryoutEffect = Effect.fn("www.marketing.readHomeTryout")(
  function* ({ locale }: HomeInput) {
    return yield* Effect.promise(() => readFeaturedTryout(locale));
  }
);

/** The handler of the home try-out server function, which the tests call directly. */
export const readHomeTryoutHandler = serverHandler(readHomeTryoutEffect);

/** Reads the curricula that the home page lists, from the signed catalog of its locale. */
const readHomeCurriculaEffect = Effect.fn("www.marketing.readHomeCurricula")(
  function* ({ locale }: HomeInput) {
    const catalog = yield* Effect.promise(() =>
      readRuntimeCurriculumCatalog(locale)
    );
    return readRuntimeCurriculumOptions(catalog, locale);
  }
);

/** The handler of the home curricula server function, which the tests call directly. */
export const readHomeCurriculaHandler = serverHandler(readHomeCurriculaEffect);
