import type { CurriculumRoute } from "@nakafa/aksara-contracts/program/curriculum";
import type { LearningProgramKey } from "@nakafa/aksara-contracts/program/spec";
import { Match, Option } from "effect";
import type { Locale } from "use-intl";
import { resolveNamedArtwork, resolveSocialArtwork } from "@/lib/og/artwork";
import { getOgUrl } from "@/lib/seo/social";

type CurriculumArtworkRoute = Pick<
  CurriculumRoute,
  "level" | "materialDomain" | "nodeKey" | "programKey"
>;

type CurriculumSocialImageRoute = Pick<CurriculumRoute, "level" | "publicPath">;

/**
 * The artwork name of what a curriculum route is: a program root names its
 * program, a class or a stage its own node, and a subject or a course the
 * subject its lessons teach. A unit, a topic or a lesson is a part of a
 * subject, not the subject, so it names none. Every curriculum reaches its
 * artwork this way, and a design added under one of these names reaches every
 * route it fits without a list to keep.
 */
function artworkIdentityOf(route: CurriculumArtworkRoute) {
  return Match.value(route.level).pipe(
    Match.when("track", () => Option.some(`curriculum/${route.programKey}`)),
    Match.whenOr("class", "stage", () => Option.some(`grade/${route.nodeKey}`)),
    Match.whenOr("subject", "course", () =>
      Option.map(
        Option.fromUndefinedOr(route.materialDomain),
        (domain) => `subject/${domain}`
      )
    ),
    Match.orElse(() => Option.none<string>())
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
    Option.flatMap(artworkIdentityOf(route), (identity) =>
      resolveNamedArtwork(identity, locale)
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
