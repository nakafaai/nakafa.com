import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import type { SchoolPart } from "@/components/marketing/school/features/list";
import {
  FeatureLead,
  FeatureText,
  FeatureTitle,
} from "@/components/marketing/shared/feature";

/**
 * The words of one part of the School landing, as every part draws them: Nina
 * doing what fits the part, which the caller gives as children, its title and
 * its one line. Her place has the id `<feature>-nina`, where the page's toys put
 * the Nina that can be carried.
 */
export function SchoolFeatureText({
  children,
  feature,
}: {
  children: ReactNode;
  feature: typeof SchoolPart.Type;
}) {
  const t = useTranslations("SchoolSite");

  return (
    <FeatureText>
      <span className="inline-block" id={`${feature}-nina`}>
        {children}
      </span>
      <FeatureTitle>{t(`${feature}-title`)}</FeatureTitle>
      <FeatureLead>{t(`${feature}-lead`)}</FeatureLead>
    </FeatureText>
  );
}
