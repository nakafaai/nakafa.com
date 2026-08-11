import type { CurriculumRoute } from "@nakafa/aksara-contracts/program/curriculum";
import type { LearningProgramKey } from "@nakafa/aksara-contracts/program/spec";
import type { Locale } from "next-intl";
import { getOgUrl } from "@/lib/utils/metadata";

const CURRICULUM_SOCIAL_IMAGE_DIRECTORY = "/open-graph/curriculum";

type CurriculumSocialImageRoute = Pick<CurriculumRoute, "level" | "publicPath">;

/** Resolves the localized artwork for the public Curriculum index. */
export function getCurriculumIndexSocialImage(locale: Locale) {
  return `${CURRICULUM_SOCIAL_IMAGE_DIRECTORY}/${locale}-index.png`;
}

/**
 * Resolves one curriculum route's social image from its signed identity.
 *
 * Curriculum roots use reviewed static artwork shared with catalog cards.
 * Deeper routes keep their route-specific generated Open Graph image.
 */
export function getCurriculumRouteSocialImage(
  locale: Locale,
  programKey: LearningProgramKey,
  route: CurriculumSocialImageRoute
) {
  if (route.level !== "track") {
    return getOgUrl(locale, route.publicPath);
  }

  return `${CURRICULUM_SOCIAL_IMAGE_DIRECTORY}/${locale}-${programKey}.png`;
}
