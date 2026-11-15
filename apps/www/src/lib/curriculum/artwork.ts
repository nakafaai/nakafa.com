import type { CurriculumRoute } from "@nakafa/aksara-contracts/program/curriculum";
import type { LearningProgramKey } from "@nakafa/aksara-contracts/program/spec";
import { Array as Arr, Match, Option } from "effect";
import type { Locale } from "use-intl";
import { resolveNamedArtwork, resolveSocialArtwork } from "@/lib/og/artwork";
import { getOgUrl } from "@/lib/seo/social";

type CurriculumArtworkRoute = Pick<
  CurriculumRoute,
  "level" | "materialDomain" | "nodeKey" | "programKey"
>;

type CurriculumSocialImageRoute = Pick<CurriculumRoute, "level" | "publicPath">;

/**
 * The artwork names of what a curriculum route is, the nearest first: a program
 * root names its program, a class or a stage its own node, and a subject or a
 * course its own node, then the subject its lessons teach. So a subject with a
 * design of its own, such as Additional Mathematics, draws it, and its sibling
 * keeps the design of the subject they share. A unit, a topic or a lesson is a
 * part of a subject, not the subject, so it names none. Every curriculum
 * reaches its artwork this way, and a design added under one of these names
 * reaches every route it fits without a list to keep.
 */
function artworkNamesOf(route: CurriculumArtworkRoute) {
  return Match.value(route.level).pipe(
    Match.when("track", () => [`curriculum/${route.programKey}`]),
    Match.whenOr("class", "stage", () => [`grade/${route.nodeKey}`]),
    Match.whenOr("subject", "course", () => [
      `subject/${route.nodeKey}`,
      ...Arr.map(
        Arr.fromOption(Option.fromUndefinedOr(route.materialDomain)),
        (domain) => `subject/${domain}`
      ),
    ]),
    Match.orElse(() => Arr.empty<string>())
  );
}

/**
 * Resolves the card artwork of one curriculum route from what it is, or
 * nothing when no design names it yet, so its card draws its tile.
 */
export function resolveCurriculumArtwork(
  locale: Locale,
  route: CurriculumArtworkRoute
) {
  return Option.getOrUndefined(
    Arr.findFirst(artworkNamesOf(route), (name) =>
      resolveNamedArtwork(name, locale)
    )
  );
}

/** The reviewed social artwork of the curriculum index. */
export function getCurriculumIndexSocialImage(
  locale: Locale,
  publicPath: string
) {
  return resolveSocialArtwork({
    identity: "curriculum/index",
    locale,
    publicPath,
  });
}

/**
 * Resolves a Learning program root from its program's artwork while deeper
 * routes keep their route-specific generated social artwork.
 */
export function getCurriculumRouteSocialImage(
  locale: Locale,
  programKey: LearningProgramKey,
  route: CurriculumSocialImageRoute
) {
  const generated = getOgUrl(locale, route.publicPath);

  if (route.level !== "track") {
    return generated;
  }

  return Option.getOrElse(
    resolveNamedArtwork(`curriculum/${programKey}`, locale),
    () => generated
  );
}
