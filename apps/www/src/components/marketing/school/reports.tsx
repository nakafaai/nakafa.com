import { CheckmarkCircle02Icon, QrCodeIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Nina } from "@repo/design-system/components/ui/nina";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { Array as Arr } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import { DEMO_REPORTED } from "@/components/marketing/school/cast";
import { SchoolFeatureText } from "@/components/marketing/school/row";
import { stepVariants } from "@/components/marketing/school/step";
import { FeatureCard, FeatureRow } from "@/components/marketing/shared/feature";

/** The subjects of the demo report card with the grades the student earned. */
const REPORT_GRADES = [
  { score: 90, step: 1, subject: "mathematics" },
  { score: 88, step: 2, subject: "physics" },
  { score: 86, step: 3, subject: "chemistry" },
  { score: 92, step: 4, subject: "biology" },
] as const;

/** The report card's average, from the grades above it. */
const REPORT_AVERAGE =
  Arr.reduce(REPORT_GRADES, 0, (sum, { score }) => sum + score) /
  REPORT_GRADES.length;

/**
 * The report cards row: one student's card as the school signs it, the grades
 * of each subject with their average, the school's signature, and the QR code
 * that lets anyone check it.
 */
export function SchoolReports() {
  const t = useTranslations("SchoolSite");
  const tSubject = useTranslations("Subject");
  const format = useFormatter();

  return (
    <FeatureRow id="reports">
      <SchoolFeatureText feature="reports">
        <Nina act="stamping" label="" size={88} whole />
      </SchoolFeatureText>
      <FeatureCard>
        <div className="flex items-center gap-3 border-b pb-4">
          <PersonAvatar mascot={DEMO_REPORTED.mascot} size="lg" />
          <div className="grid min-w-0 gap-0.5">
            <p className="truncate font-medium">{DEMO_REPORTED.name}</p>
            <p className="text-muted-foreground truncate text-sm">
              {t("demo-report-term")}
            </p>
          </div>
        </div>
        <dl className="grid gap-3">
          {Arr.map(REPORT_GRADES, ({ score, subject }) => (
            <div
              className="flex items-center justify-between gap-4"
              key={subject}
            >
              <dt className="text-sm">{tSubject(subject)}</dt>
              <dd className="text-sm tabular-nums">{format.number(score)}</dd>
            </div>
          ))}
          <div
            className={stepVariants({
              className:
                "flex items-center justify-between gap-4 border-t pt-3",
              step: 5,
            })}
          >
            <dt className="text-sm font-medium">{t("demo-report-average")}</dt>
            <dd className="text-sm font-medium tabular-nums">
              {format.number(REPORT_AVERAGE)}
            </dd>
          </div>
        </dl>
        <div
          className={stepVariants({
            className:
              "flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm",
            step: 6,
          })}
        >
          <p className="flex items-center gap-2">
            <HugeIcons className="text-success" icon={CheckmarkCircle02Icon} />
            {t("demo-report-signed")}
          </p>
          <p className="text-muted-foreground flex items-center gap-2">
            <HugeIcons icon={QrCodeIcon} />
            {t("demo-report-verify")}
          </p>
        </div>
      </FeatureCard>
    </FeatureRow>
  );
}
