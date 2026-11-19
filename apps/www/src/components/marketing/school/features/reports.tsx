import {
  Analytics01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { getMaterialIcons } from "@repo/contents/curriculum/material";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Nina } from "@repo/design-system/components/ui/nina";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import { DEMO_REPORTED } from "@/components/marketing/school/features/cast";
import { SchoolFeatureText } from "@/components/marketing/school/features/text";
import {
  FeatureProduct,
  FeatureRow,
} from "@/components/marketing/shared/feature";
import { QrImage } from "@/components/shared/qr/image";

/** The subjects of the demo report card with the grades the student earned. */
const REPORT_GRADES = [
  { score: 90, subject: "mathematics" },
  { score: 88, subject: "physics" },
  { score: 86, subject: "chemistry" },
  { score: 92, subject: "biology" },
] as const;

/** The report card's average, from the grades above it. */
const REPORT_AVERAGE =
  Arr.reduce(REPORT_GRADES, 0, (sum, { score }) => sum + score) /
  REPORT_GRADES.length;

/** A subject's score or the report's average, with the same label and number alignment. */
function ReportScore({
  icon,
  label,
  score,
  summary,
}: {
  icon: ComponentProps<typeof HugeIcons>["icon"];
  label: string;
  score: number;
  summary?: boolean;
}) {
  const format = useFormatter();

  return (
    <div
      className="data-summary:bg-muted/30 flex items-start justify-between gap-4 px-(--card-spacing) py-1.5 data-summary:mt-4 data-summary:border-t data-summary:py-4 data-summary:font-medium"
      data-summary={summary ? "" : undefined}
    >
      <dt className="flex min-w-0 items-start gap-2.5">
        <HugeIcons
          aria-hidden="true"
          className="text-muted-foreground mt-0.5"
          icon={icon}
        />
        <span className="wrap-anywhere">{label}</span>
      </dt>
      <dd className="font-mono tabular-nums">{format.number(score)}</dd>
    </div>
  );
}

/** A school report with its grades and a single, always visible verification panel. */
function ReportCard() {
  const t = useTranslations("SchoolSite");
  const tCommon = useTranslations("Common");
  const tSubject = useTranslations("Subject");
  const locale = useLocale();
  const address = new URL(`/${locale}/school#reports`, SITE_ORIGIN).href;

  return (
    <Card className="mx-auto max-w-3xl gap-0 py-0">
      <div className="grid min-w-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]">
        <div className="flex min-w-0 flex-col gap-4 pt-(--card-spacing)">
          <CardHeader className="flex items-center gap-3">
            <PersonAvatar mascot={DEMO_REPORTED.mascot} size="lg" />
            <div className="grid min-w-0 gap-0.5">
              <CardTitle>{DEMO_REPORTED.name}</CardTitle>
              <CardDescription>{t("demo-report-term")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="mt-auto px-0">
            <dl>
              {Arr.map(REPORT_GRADES, ({ score, subject }) => {
                const [icon] = getMaterialIcons(subject);
                return (
                  <ReportScore
                    icon={icon}
                    key={subject}
                    label={tSubject(subject)}
                    score={score}
                  />
                );
              })}
              <ReportScore
                icon={Analytics01Icon}
                label={tCommon("average")}
                score={REPORT_AVERAGE}
                summary
              />
            </dl>
          </CardContent>
        </div>
        <div className="bg-muted/30 grid content-center justify-items-center gap-4 border-t p-(--card-spacing) text-center sm:border-s sm:border-t-0">
          <div className="overflow-hidden rounded-lg">
            <QrImage
              label={t("reports-scan-code")}
              size="card"
              text={address}
            />
          </div>
          <div className="grid justify-items-center gap-1">
            <p className="text-success flex items-center gap-2 font-medium">
              <HugeIcons icon={CheckmarkCircle02Icon} />
              {t("reports-verified")}
            </p>
            <p className="text-muted-foreground">{t("demo-report-signed")}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Shows the report a school signs alongside the code used to verify it.
 */
export function SchoolReports() {
  return (
    <FeatureRow id="reports" layout="wide">
      <SchoolFeatureText feature="reports">
        <Nina act="stamping" label="" size={88} whole />
      </SchoolFeatureText>
      <FeatureProduct>
        <ReportCard />
      </FeatureProduct>
    </FeatureRow>
  );
}
