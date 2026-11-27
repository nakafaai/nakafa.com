import type { CurriculumRoute } from "@nakafa/aksara-contracts/program/curriculum";
import { Array as Arr, Option, Record as Rec, Schema } from "effect";
import type { Locale } from "use-intl";
import { resolveCardArtwork, resolveSocialArtwork } from "@/lib/og/artwork";
import { getOgUrl } from "@/lib/seo/social";

type CurriculumArtworkRoute = Pick<CurriculumRoute, "nodeKey">;

type CurriculumSocialImageRoute = Pick<
  CurriculumRoute,
  "level" | "nodeKey" | "publicPath"
>;

/** The design of one card, and the locales whose label it reads when not all of the design's readers do. */
const CurriculumCardArtworkSchema = Schema.Struct({
  identity: Schema.String,
  locales: Schema.optionalKey(Schema.Array(Schema.String)),
});

const MATHEMATICS = { identity: "subject/mathematics" } as const;
const PHYSICS = { identity: "subject/physics" } as const;
const CHEMISTRY = { identity: "subject/chemistry" } as const;
const BIOLOGY = { identity: "subject/biology" } as const;

/**
 * The design of each curriculum card whose lettering reads the card's label,
 * by the card's node key. A card that is not listed draws its tile: a course
 * such as "Mathematik im T-Kurs" or "Biology 0610" names more than the plain
 * subject design says, so it waits for a design of its own. A new node draws
 * its tile until its design is reviewed and listed here.
 */
const CURRICULUM_CARD_ARTWORK = {
  "cambridge-international:root": {
    identity: "curriculum/cambridge-international",
  },
  "class-10": { identity: "grade/class-10" },
  "class-10-biology": BIOLOGY,
  "class-10-chemistry": CHEMISTRY,
  "class-10-mathematics": MATHEMATICS,
  "class-10-physics": PHYSICS,
  "class-11": { identity: "grade/class-11" },
  "class-11-biology": BIOLOGY,
  "class-11-chemistry": CHEMISTRY,
  "class-11-mathematics": MATHEMATICS,
  "class-11-physics": PHYSICS,
  "class-12": { identity: "grade/class-12" },
  "class-12-chemistry": CHEMISTRY,
  "class-12-mathematics": MATHEMATICS,
  "class-12-physics": PHYSICS,
  "form-4": { identity: "grade/form-4" },
  "form-4-additional-mathematics": {
    identity: "subject/additional-mathematics",
    locales: ["en"],
  },
  "form-4-biology": BIOLOGY,
  "form-4-chemistry": CHEMISTRY,
  "form-4-mathematics": MATHEMATICS,
  "form-4-physics": PHYSICS,
  "form-5": { identity: "grade/form-5" },
  "form-5-additional-mathematics": {
    identity: "subject/additional-mathematics",
    locales: ["en"],
  },
  "form-5-biology": BIOLOGY,
  "form-5-chemistry": CHEMISTRY,
  "form-5-mathematics": MATHEMATICS,
  "form-5-physics": PHYSICS,
  hannover: { identity: "grade/hannover" },
  "high-school": { identity: "grade/high-school" },
  "high-school-mathematics": MATHEMATICS,
  "high-school-science": { identity: "subject/science" },
  "introductory-phase-biology": BIOLOGY,
  "introductory-phase-chemistry": CHEMISTRY,
  "introductory-phase-mathematics": MATHEMATICS,
  "introductory-phase-physics": PHYSICS,
  "kssm:root": { identity: "curriculum/kssm" },
  "merdeka:root": { identity: "curriculum/merdeka" },
  "qualification-phase-1-chemistry": CHEMISTRY,
  "qualification-phase-1-mathematics": MATHEMATICS,
  "qualification-phase-2-biology": BIOLOGY,
  "qualification-phase-2-chemistry": CHEMISTRY,
  "qualification-phase-2-mathematics": MATHEMATICS,
  "qualification-phase-2-physics": PHYSICS,
  "qualification-phase-3-chemistry": CHEMISTRY,
  "qualification-phase-3-mathematics": MATHEMATICS,
  "qualification-phase-3-physics": PHYSICS,
  "qualification-phase-4-biology": BIOLOGY,
  "qualification-phase-4-chemistry": CHEMISTRY,
  "qualification-phase-4-mathematics": MATHEMATICS,
  "qualification-phase-4-physics": PHYSICS,
  sachsen: { identity: "grade/sachsen" },
  secondary: { identity: "grade/secondary" },
  "secondary-additional-mathematics": {
    identity: "subject/additional-mathematics",
  },
  "secondary-biology": BIOLOGY,
  "secondary-chemistry": CHEMISTRY,
  "secondary-mathematics": MATHEMATICS,
  "secondary-physics": PHYSICS,
  "singapore-moe:root": { identity: "curriculum/singapore-moe" },
  "tu-darmstadt": { identity: "grade/tu-darmstadt" },
  "united-states:root": { identity: "curriculum/united-states" },
  "upper-secondary": { identity: "grade/upper-secondary" },
} as const satisfies Readonly<
  Record<string, typeof CurriculumCardArtworkSchema.Type>
>;

/** The card designs read by any node key, so a node that is not listed finds none. */
const curriculumCards: Readonly<
  Record<
    string,
    (typeof CURRICULUM_CARD_ARTWORK)[keyof typeof CURRICULUM_CARD_ARTWORK]
  >
> = CURRICULUM_CARD_ARTWORK;

/** The design of one curriculum card in the locale, or nothing when its card draws a tile. */
function cardArtworkOf(locale: Locale, route: CurriculumArtworkRoute) {
  return Option.filter(
    Rec.get(curriculumCards, route.nodeKey),
    (artwork) =>
      !("locales" in artwork) || Arr.contains(artwork.locales, locale)
  );
}

/**
 * Resolves the card artwork of one curriculum route, or nothing when no
 * design reads its label in the locale yet, so its card draws its tile.
 */
export function resolveCurriculumArtwork(
  locale: Locale,
  route: CurriculumArtworkRoute
) {
  return Option.getOrUndefined(
    Option.flatMapNullishOr(cardArtworkOf(locale, route), (artwork) =>
      resolveCardArtwork(artwork.identity, locale)
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
  route: CurriculumSocialImageRoute
) {
  if (route.level !== "track") {
    return getOgUrl(locale, route.publicPath);
  }

  return resolveSocialArtwork({
    identity: Option.getOrUndefined(
      Option.map(
        Rec.get(curriculumCards, route.nodeKey),
        (artwork) => artwork.identity
      )
    ),
    locale,
    publicPath: route.publicPath,
  });
}
