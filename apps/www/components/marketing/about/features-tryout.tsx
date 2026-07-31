import choices from "@repo/contents/question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-1/choices";
import QuestionEn from "@repo/contents/question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-1/question.en.mdx";
import QuestionId from "@repo/contents/question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-1/question.id.mdx";
import { useLocale, useTranslations } from "next-intl";
import { FeaturesTryoutChoices } from "@/components/marketing/about/features-tryout-choices";

/** Uses a real Nakafa question and the production Tryout choice surface. */
export function FeaturesTryout() {
  const locale = useLocale();
  const t = useTranslations("Features");
  const Question = locale === "id" ? QuestionId : QuestionEn;
  const localizedChoices = locale === "id" ? choices.id : choices.en;

  return (
    <div className="relative flex min-h-[38rem] flex-col overflow-hidden border-b bg-background lg:col-span-5 lg:min-h-[40rem]">
      <h3 className="text-balance p-8 text-3xl tracking-tight sm:text-4xl lg:p-10">
        {t.rich("tryout-title", {
          mark: (chunks) => <mark>{chunks}</mark>,
        })}
      </h3>
      <article className="mt-auto px-8 pt-10 pb-8 lg:px-10 lg:pt-12 lg:pb-10">
        <section className="my-6">
          <Question />
        </section>
        <section className="my-8">
          <FeaturesTryoutChoices choices={localizedChoices} />
        </section>
      </article>
    </div>
  );
}
