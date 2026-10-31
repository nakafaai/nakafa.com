import type { Effect } from "effect";
import { useTranslations } from "use-intl";
import {
  TryoutDemo,
  TryoutDemoNina,
  TryoutDemoQuestion,
} from "@/components/marketing/about/tryout/demo";
import {
  FeatureCard,
  FeatureLead,
  FeatureRow,
  FeatureText,
  FeatureTitle,
} from "@/components/marketing/shared/feature";
import type { readFeaturedTryout } from "@/components/tryout/catalog/source.server";
import { TryoutQuestionBody } from "@/components/tryout/runtime/question/body";

/** The featured question's body, as the catalog decodes it: its prompt, its interaction, and its key. */
type FeaturedTryout = Effect.Success<ReturnType<typeof readFeaturedTryout>>;

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
          <section>
            <TryoutQuestionBody body={value} />
          </section>
          <TryoutDemoQuestion
            answer={value.key}
            id={responseId}
            interaction={value.interaction}
          />
        </FeatureCard>
      </FeatureRow>
    </TryoutDemo>
  );
}
