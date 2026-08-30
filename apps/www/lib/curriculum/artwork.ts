import { MaterialDomainSchema } from "@nakafa/aksara-contracts/material/domain";
import type { CurriculumRoute } from "@nakafa/aksara-contracts/program/curriculum";
import type { LearningProgramKey } from "@nakafa/aksara-contracts/program/spec";
import type { Locale } from "next-intl";
import {
  type ArtworkIdentity,
  resolveSocialArtwork,
  resolveStaticArtwork,
} from "@/lib/og/artwork";
import { getOgUrl } from "@/lib/utils/metadata";

const GRADE_ARTWORK_BY_ICON_KEY = new Map<
  CurriculumRoute["iconKey"],
  ArtworkIdentity
>([
  ["grade-9", "grade/9"],
  ["grade-10", "grade/10"],
  ["grade-11", "grade/11"],
  ["grade-12", "grade/12"],
]);

const SUBJECT_ARTWORK_BY_MATERIAL_DOMAIN = new Map<
  NonNullable<CurriculumRoute["materialDomain"]>,
  ArtworkIdentity
>([
  [MaterialDomainSchema.make("ai-ds"), "subject/ai-ds"],
  [MaterialDomainSchema.make("biology"), "subject/biology"],
  [MaterialDomainSchema.make("chemistry"), "subject/chemistry"],
  [MaterialDomainSchema.make("computer-science"), "subject/computer-science"],
  [MaterialDomainSchema.make("economy"), "subject/economics"],
  [MaterialDomainSchema.make("english-language"), "subject/english-language"],
  [MaterialDomainSchema.make("general-reasoning"), "subject/general-reasoning"],
  [MaterialDomainSchema.make("geography"), "subject/geography"],
  [MaterialDomainSchema.make("geospatial"), "subject/geospatial"],
  [MaterialDomainSchema.make("history"), "subject/history"],
  [
    MaterialDomainSchema.make("indonesian-language"),
    "subject/indonesian-language",
  ],
  [MaterialDomainSchema.make("informatics"), "subject/informatics"],
  [
    MaterialDomainSchema.make("mathematical-reasoning"),
    "subject/mathematical-reasoning",
  ],
  [MaterialDomainSchema.make("mathematics"), "subject/mathematics"],
  [MaterialDomainSchema.make("physics"), "subject/physics"],
  [
    MaterialDomainSchema.make("quantitative-knowledge"),
    "subject/quantitative-knowledge",
  ],
  [MaterialDomainSchema.make("sociology"), "subject/sociology"],
  [
    MaterialDomainSchema.make("technology-electro-medical"),
    "subject/technology-electro-medical",
  ],
]);

type CurriculumSocialImageRoute = Pick<CurriculumRoute, "level" | "publicPath">;

type CurriculumCatalogArtworkSource =
  | {
      readonly kind: "program";
      readonly programKey: LearningProgramKey;
    }
  | ({
      readonly kind: "route";
    } & Pick<CurriculumRoute, "iconKey" | "materialDomain">);

/** Resolves reviewed card artwork from one signed curriculum identity. */
export function resolveCurriculumCatalogArtwork(
  locale: Locale,
  source: CurriculumCatalogArtworkSource
) {
  const identity =
    source.kind === "program"
      ? getCurriculumArtworkIdentity(source.programKey)
      : (GRADE_ARTWORK_BY_ICON_KEY.get(source.iconKey) ??
        (source.materialDomain
          ? SUBJECT_ARTWORK_BY_MATERIAL_DOMAIN.get(source.materialDomain)
          : undefined));

  return identity ? resolveStaticArtwork(identity, locale) : undefined;
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

  const identity = getCurriculumArtworkIdentity(programKey);
  return resolveSocialArtwork({
    identity,
    locale,
    publicPath: route.publicPath,
  });
}

function getCurriculumArtworkIdentity(
  programKey: LearningProgramKey
): ArtworkIdentity | undefined {
  switch (programKey) {
    case "cambridge-international":
      return "curriculum/cambridge-international";
    case "merdeka":
      return "curriculum/merdeka";
    case "singapore-moe":
      return "curriculum/singapore-moe";
    case "united-states":
      return "curriculum/united-states";
    default:
      return;
  }
}
