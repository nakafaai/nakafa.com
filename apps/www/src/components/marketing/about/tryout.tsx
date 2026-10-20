import { useTranslations } from "use-intl";
import {
  TryoutDemo,
  TryoutDemoNina,
  TryoutDemoQuestion,
} from "@/components/marketing/about/tryout/demo.client";
import {
  FeatureCard,
  FeatureLead,
  FeatureRow,
  FeatureText,
  FeatureTitle,
} from "@/components/marketing/shared/feature";
import type { readFeaturedTryout } from "@/components/tryout/catalog/server";
import { renderTryoutResponseLabels } from "@/components/tryout/runtime/response/labels";

/** The featured question and its response, as the catalog reads them. */
type FeaturedTryout = Awaited<ReturnType<typeof readFeaturedTryout>>;

/**
 * The practice test row: its words on one side, and on the other a card with a
 * real question and its real choices, which answers itself once it is on
 * screen while Nina beside the title thinks, then cheers a right answer.
 */
export function Tryout({ value }: { value: FeaturedTryout }) {
  const t = useTranslations("Landing");
  const responseId = "home-tryout-response";

  return (
    <TryoutDemo>
      <FeatureRow id="tryout">
        <FeatureText>
          <TryoutDemoNina />
          <FeatureTitle>{t("tryout-title")}</FeatureTitle>
          <FeatureLead>{t("tryout-lead")}</FeatureLead>
        </FeatureText>
        <FeatureCard>
          <section>{value.question}</section>
          <TryoutDemoQuestion
            id={responseId}
            labels={renderTryoutResponseLabels(responseId, value.response)}
            responseSpec={value.response}
          />
        </FeatureCard>
      </FeatureRow>
    </TryoutDemo>
  );
}
