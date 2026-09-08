import type { CurriculumRoute } from "@nakafa/aksara-contracts/program/curriculum";
import type { LearningProgramKey } from "@nakafa/aksara-contracts/program/spec";
import type { Locale } from "next-intl";
import {
  type ArtworkIdentity,
  resolveSocialArtwork,
  resolveStaticArtwork,
} from "@/lib/og/artwork";
import { getOgUrl } from "@/lib/utils/metadata";

/**
 * Reviewed artwork for exact signed program and node identities.
 * Material domains and icons describe shared content, not course identity.
 * Add a node only when its own title matches reviewed public artwork.
 */
const CURRICULUM_ARTWORK_BY_IDENTITY = new Map<string, ArtworkIdentity>([
  ["cambridge-international", "curriculum/cambridge-international"],
  ["cambridge-international/upper-secondary", "grade/upper-secondary"],
  ["cambridge-international/mathematics-0580", "subject/mathematics"],
  ["cambridge-international/biology-0610", "subject/biology"],
  ["cambridge-international/chemistry-0620", "subject/chemistry"],
  ["cambridge-international/physics-0625", "subject/physics"],
  ["merdeka", "curriculum/merdeka"],
  ["merdeka/class-9", "grade/9"],
  ["merdeka/class-10", "grade/10"],
  ["merdeka/class-11", "grade/11"],
  ["merdeka/class-12", "grade/12"],
  ["merdeka/class-10-biology", "subject/biology"],
  ["merdeka/class-10-chemistry", "subject/chemistry"],
  ["merdeka/class-10-mathematics", "subject/mathematics"],
  ["merdeka/class-10-physics", "subject/physics"],
  ["merdeka/class-11-mathematics", "subject/mathematics"],
  ["merdeka/class-11-physics", "subject/physics"],
  ["merdeka/class-12-mathematics", "subject/mathematics"],
  ["singapore-moe", "curriculum/singapore-moe"],
  ["singapore-moe/secondary", "grade/secondary"],
  ["singapore-moe/secondary-mathematics", "subject/mathematics"],
  ["singapore-moe/secondary-science-physics", "subject/physics"],
  ["singapore-moe/secondary-science-chemistry", "subject/chemistry"],
  ["singapore-moe/secondary-science-biology", "subject/biology"],
  ["united-states", "curriculum/united-states"],
  ["united-states/high-school-mathematics", "subject/mathematics"],
]);

type CurriculumSocialImageRoute = Pick<CurriculumRoute, "level" | "publicPath">;

type CurriculumCatalogArtworkSource =
  | {
      readonly kind: "program";
      readonly programKey: LearningProgramKey;
    }
  | ({
      readonly kind: "route";
    } & Pick<CurriculumRoute, "programKey" | "nodeKey">);

/** Resolves reviewed card artwork from one signed curriculum identity. */
export function resolveCurriculumCatalogArtwork(
  locale: Locale,
  source: CurriculumCatalogArtworkSource
) {
  const key =
    source.kind === "program"
      ? source.programKey
      : `${source.programKey}/${source.nodeKey}`;

  return resolveStaticArtwork(CURRICULUM_ARTWORK_BY_IDENTITY.get(key), locale);
}

/** Keeps the curriculum index on its localized generated social artwork. */
export function getCurriculumIndexSocialImage(
  locale: Locale,
  publicPath: string
) {
  return resolveSocialArtwork({ identity: undefined, locale, publicPath });
}

/**
 * Resolves a Learning program root from stable identity while deeper routes
 * keep their route-specific generated social artwork.
 */
export function getCurriculumRouteSocialImage(
  locale: Locale,
  programKey: LearningProgramKey,
  route: CurriculumSocialImageRoute
) {
  if (route.level !== "track") {
    return getOgUrl(locale, route.publicPath);
  }

  return resolveSocialArtwork({
    identity: CURRICULUM_ARTWORK_BY_IDENTITY.get(programKey),
    locale,
    publicPath: route.publicPath,
  });
}
