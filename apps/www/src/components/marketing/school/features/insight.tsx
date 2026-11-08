import { Badge } from "@repo/design-system/components/ui/badge";
import { Nina } from "@repo/design-system/components/ui/nina";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { Array as Arr } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import { DEMO_STRUGGLING } from "@/components/marketing/school/features/cast";
import { stepVariants } from "@/components/marketing/school/features/step";
import { SchoolFeatureText } from "@/components/marketing/school/features/text";
import { FeatureCard, FeatureRow } from "@/components/marketing/shared/feature";

/** The class average of each of the last six weeks, out of 100. */
const WEEKLY_AVERAGES = [
  { average: 72, week: 1 },
  { average: 75, week: 2 },
  { average: 74, week: 3 },
  { average: 79, week: 4 },
  { average: 81, week: 5 },
  { average: 84, week: 6 },
] as const;

/** The subject and the grade that put each struggling student on the list. */
const STRUGGLES = [
  { score: 58, subject: "physics" },
  { score: 61, subject: "mathematics" },
] as const;

/**
 * The insight row: the class average over six weeks as bars, and the students
 * who need help, each with the subject and the grade that shows it, before any
 * report is due.
 */
export function SchoolInsight() {
  const t = useTranslations("SchoolSite");
  const tSubject = useTranslations("Subject");
  const format = useFormatter();

  return (
    <FeatureRow id="insight">
      <SchoolFeatureText feature="insight">
        <Nina act="searching" label="" size={88} whole />
      </SchoolFeatureText>
      <FeatureCard>
        <div className="flex items-center justify-between gap-4">
          <p className="truncate font-medium">{t("demo-insight-title")}</p>
          <p className="text-muted-foreground truncate text-sm">
            {t("demo-class")}
          </p>
        </div>
        <ol className="flex h-40 items-end gap-3">
          {Arr.map(WEEKLY_AVERAGES, ({ average, week }) => (
            <li
              className={stepVariants({
                className:
                  "flex h-full flex-1 flex-col items-center justify-end gap-2",
                step: week,
              })}
              key={week}
            >
              <span className="text-muted-foreground text-xs tabular-nums">
                {format.number(average)}
              </span>
              <span
                className="bg-chart-1 w-full rounded-t-md"
                style={{ height: `${average - 40}%` }}
              />
              <span className="text-muted-foreground text-xs">
                {t("demo-insight-week", { week })}
              </span>
            </li>
          ))}
        </ol>
        <div className="grid gap-3 border-t pt-4">
          <p className="text-sm font-medium">{t("demo-insight-attention")}</p>
          <ul className="grid gap-3">
            {Arr.map(
              Arr.zip(DEMO_STRUGGLING, STRUGGLES),
              ([student, { score, subject }]) => (
                <li className="flex items-center gap-3" key={student.name}>
                  <PersonAvatar mascot={student.mascot} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {student.name}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {tSubject(subject)}
                  </span>
                  <Badge className="tabular-nums" variant="destructive-subtle">
                    {format.number(score)}
                  </Badge>
                </li>
              )
            )}
          </ul>
        </div>
      </FeatureCard>
    </FeatureRow>
  );
}
