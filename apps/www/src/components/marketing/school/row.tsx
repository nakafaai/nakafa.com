import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import type { SCHOOL_FEATURES } from "@/components/marketing/school/features";
import {
  FeatureLead,
  FeatureText,
  FeatureTitle,
} from "@/components/marketing/shared/feature";

/**
 * The words of one School feature, as every row of the landing draws them: Nina
 * doing what fits the feature, which the caller gives as children, its title and
 * its one line.
 */
export function SchoolFeatureText({
  children,
  feature,
}: {
  children: ReactNode;
  feature: (typeof SCHOOL_FEATURES)[number]["key"];
}) {
  const t = useTranslations("SchoolSite");

  return (
    <FeatureText>
      <span className="inline-block">{children}</span>
      <FeatureTitle>{t(`${feature}-title`)}</FeatureTitle>
      <FeatureLead>{t(`${feature}-lead`)}</FeatureLead>
    </FeatureText>
  );
}
