import { useTranslations } from "next-intl";
import { MemoryDesk } from "@/components/marketing/about/memory/desk.client";
import {
  FeatureCard,
  FeatureLead,
  FeatureRow,
  FeatureText,
  FeatureTitle,
} from "@/components/marketing/shared/feature";

/**
 * The memory row: its words beside a card where Nina writes down five things the
 * learner says, and the notebooks pile up beside her as the days pass.
 */
export function Memory() {
  const t = useTranslations("Landing");
  const facts = [
    { said: t("memory-said-1"), when: t("memory-when-day") },
    { said: t("memory-said-2"), when: t("memory-when-day") },
    { said: t("memory-said-3"), when: t("memory-when-week") },
    { said: t("memory-said-4"), when: t("memory-when-week") },
    { said: t("memory-said-5"), when: t("memory-when-month") },
  ];

  return (
    <FeatureRow id="memory">
      <FeatureText>
        <FeatureTitle>{t("memory-title")}</FeatureTitle>
        <FeatureLead>{t("memory-lead")}</FeatureLead>
      </FeatureText>
      <FeatureCard>
        <MemoryDesk facts={facts} />
      </FeatureCard>
    </FeatureRow>
  );
}
