import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { MarketingSection } from "@/components/marketing/shared/section";

/** The three steps from no school to teaching in one. */
const SCHOOL_STEPS = ["open", "invite", "teach"] as const;

/** One step: its number in a circle, its name, and one sentence. */
function SchoolStep({
  place,
  step,
}: {
  place: number;
  step: (typeof SCHOOL_STEPS)[number];
}) {
  const t = useTranslations("SchoolSite");

  return (
    <li className="grid content-start justify-items-center gap-3 text-center">
      <span
        aria-hidden="true"
        className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-full text-base font-medium tabular-nums"
      >
        {place}
      </span>
      <h3 className="text-xl font-medium tracking-tight">
        {t(`step-${step}-title`)}
      </h3>
      <p className="text-muted-foreground max-w-72 text-base text-pretty">
        {t(`step-${step}-text`)}
      </p>
    </li>
  );
}

/** How a school starts: three numbered steps in a row, one under another on a phone. */
export function SchoolSteps() {
  const t = useTranslations("SchoolSite");

  return (
    <MarketingSection id="steps" labelledBy="school-steps-title">
      <div className="mx-auto grid w-full max-w-5xl gap-12">
        <h2
          className="text-center text-3xl tracking-tight text-balance sm:text-4xl"
          id="school-steps-title"
        >
          {t("steps-title")}
        </h2>
        <ol className="grid gap-10 md:grid-cols-3">
          {Arr.map(SCHOOL_STEPS, (step, index) => (
            <SchoolStep key={step} place={index + 1} step={step} />
          ))}
        </ol>
      </div>
    </MarketingSection>
  );
}
