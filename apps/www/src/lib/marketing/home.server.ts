import { Effect } from "effect";
import {
  readRuntimeCurriculumCatalog,
  readRuntimeCurriculumOptions,
} from "@/lib/curriculum/model";
import type { HomeInput } from "@/lib/marketing/home.functions";
import { serverHandler } from "@/lib/server/fn";

/** Reads the curricula that the home page lists, from the signed catalog of its locale. */
const readHomeCurriculaEffect = Effect.fn("www.marketing.readHomeCurricula")(
  function* ({ locale }: HomeInput) {
    const catalog = yield* readRuntimeCurriculumCatalog(locale);
    return readRuntimeCurriculumOptions(catalog);
  }
);

/** The handler of the home curricula server function, which the tests call directly. */
export const readHomeCurriculaHandler = serverHandler(readHomeCurriculaEffect);
