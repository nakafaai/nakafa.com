import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { Effect, HashMap, Option } from "effect";
import { permanentRedirect } from "@/lib/routing/public/redirect";
import {
  readActiveTryoutPath,
  SNBT_ROUTE,
  TRYOUT_ROOT,
} from "@/lib/routing/public/tryout/route";

/**
 * UTBK-SNBT section route segments retired when the sections took their
 * official names, mapped to their successors in each app locale.
 */
const RETIRED_SNBT_SECTIONS = {
  de: HashMap.make(
    ["allgemeines-logisches-denken", "allgemeines-schlussfolgern"],
    ["allgemeinwissen", "allgemeines-wissen-und-verstaendnis"],
    ["englische-sprache", "lesekompetenz-in-englischer-sprache"],
    ["indonesische-sprache", "lesekompetenz-in-indonesischer-sprache"],
    ["lese-und-schreibkompetenz", "leseverstaendnis-und-schreiben"]
  ),
  en: HashMap.make(
    ["english-language", "literacy-in-english"],
    ["general-knowledge", "general-knowledge-and-understanding"],
    ["indonesian-language", "literacy-in-indonesian"],
    ["reading-and-writing-skills", "reading-comprehension-and-writing"]
  ),
  id: HashMap.make(
    ["bahasa-indonesia", "literasi-dalam-bahasa-indonesia"],
    ["bahasa-inggris", "literasi-dalam-bahasa-inggris"],
    ["literasi-membaca-menulis", "pemahaman-bacaan-dan-menulis"],
    ["pengetahuan-umum", "pengetahuan-dan-pemahaman-umum"]
  ),
};

type RetiredSectionLocale = keyof typeof RETIRED_SNBT_SECTIONS;

function isRetiredSectionLocale(
  locale: string | undefined
): locale is RetiredSectionLocale {
  return locale !== undefined && Object.hasOwn(RETIRED_SNBT_SECTIONS, locale);
}

/** Reads one retired SNBT section URL as its retired and successor routes. */
function readRetiredSnbtSection(pathname: string) {
  const [appLocale, root, country, exam, track, set, section, ...rest] =
    pathname.split("/").filter(Boolean);
  if (
    !(
      isRetiredSectionLocale(appLocale) &&
      root === TRYOUT_ROOT &&
      exam === SNBT_ROUTE &&
      country &&
      track &&
      set &&
      section &&
      rest.length === 0
    )
  ) {
    return null;
  }
  const successor = HashMap.get(RETIRED_SNBT_SECTIONS[appLocale], section);
  if (Option.isNone(successor)) {
    return null;
  }
  const setPath = [root, country, exam, track, set].join("/");
  return {
    appLocale,
    previousPath: `${setPath}/${section}`,
    successorPath: `${setPath}/${successor.value}`,
  };
}

/** Applies the retired section rename map of one locale and keeps every other key. */
export function readSectionSuccessor(
  appLocale: AppLocaleCode,
  section: string
) {
  return Option.getOrElse(
    HashMap.get(RETIRED_SNBT_SECTIONS[appLocale], section),
    () => section
  );
}

/**
 * Resolves a retired SNBT section URL to its successor, only once the active
 * signed catalog has dropped the retired route and serves the successor. The
 * renamed section does not move, so the answer is a permanent redirect.
 */
export const readRetiredSectionRedirect = Effect.fn(
  "www.routing.publicHtml.tryoutSectionMigration"
)(function* (pathname: string) {
  const retired = readRetiredSnbtSection(pathname);
  if (!retired) {
    return null;
  }
  const [previous, successor] = yield* Effect.all(
    [
      readActiveTryoutPath(retired.appLocale, retired.previousPath),
      readActiveTryoutPath(retired.appLocale, retired.successorPath),
    ],
    { concurrency: 2 }
  );
  if (previous !== null || successor === null) {
    return null;
  }
  return permanentRedirect(`/${retired.appLocale}/${successor}`);
});
