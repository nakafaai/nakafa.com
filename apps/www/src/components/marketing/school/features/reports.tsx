import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Nina } from "@repo/design-system/components/ui/nina";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr } from "effect";
import type { AnimationSequence } from "motion";
import type { CSSProperties } from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import { DEMO_REPORTED } from "@/components/marketing/school/features/cast";
import { stepVariants } from "@/components/marketing/school/features/step";
import { SchoolFeatureText } from "@/components/marketing/school/features/text";
import { useFlowPlay } from "@/components/marketing/school/flow/stage";
import {
  FeatureProduct,
  FeatureRow,
} from "@/components/marketing/shared/feature";
import { QrImage } from "@/components/shared/qr/image";

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

/** The answer of a scan starts under the phone's screen and rises into it. */
const HIDDEN: CSSProperties = { "--hide": 0 };

/**
 * The story of the scan, six seconds long: the answer leaves the phone's
 * screen, a line of light passes down the code as the camera reads it, and
 * the answer rises back, which says the report card is real.
 */
function composeScan(phone: HTMLElement): AnimationSequence {
  const all = (selector: string) => phone.querySelectorAll(selector);

  return [
    [all("[data-answer]"), { "--hide": 1 }, { at: 0, duration: 0.3 }],
    [
      all("[data-beam]"),
      { "--scan": [0, 1], opacity: [0, 1, 1, 0] },
      { at: 0.8, duration: 1.4, ease: "easeInOut" },
    ],
    [
      all("[data-answer]"),
      { "--hide": 0 },
      { at: 2.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
    ],
    [phone, { opacity: 1 }, { at: 6, duration: 0.01 }],
  ];
}

/** The address the demo's code opens: this part of the page, where a real code opens the signed copy of its card. */
function useDemoAddress() {
  const locale = useLocale();
  return `${SITE_ORIGIN}/${locale}/school#reports`;
}

/**
 * One student's report card as the school signs it: who it is for, the grade
 * of each subject and their average, and in its footer the school's signature
 * beside the code that proves it.
 */
function ReportCard() {
  const t = useTranslations("SchoolSite");
  const tCommon = useTranslations("Common");
  const tSubject = useTranslations("Subject");
  const format = useFormatter();
  const address = useDemoAddress();

  return (
    <Card className="rise-on-scroll w-full max-w-md justify-self-center [--rise-delay:15%]">
      <CardHeader className="flex items-center gap-3">
        <PersonAvatar mascot={DEMO_REPORTED.mascot} size="lg" />
        <div className="grid min-w-0 gap-0.5">
          <CardTitle>{DEMO_REPORTED.name}</CardTitle>
          <CardDescription>{t("demo-report-term")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3">
          {Arr.map(REPORT_GRADES, ({ score, step, subject }) => (
            <div
              className={stepVariants({
                className: "flex items-center justify-between gap-4",
                step,
              })}
              key={subject}
            >
              <dt className="text-sm">{tSubject(subject)}</dt>
              <dd className="font-mono text-sm tabular-nums">
                {format.number(score)}
              </dd>
            </div>
          ))}
          <div
            className={stepVariants({
              className:
                "flex items-center justify-between gap-4 border-t pt-3",
              step: 5,
            })}
          >
            <dt className="text-sm font-medium">{tCommon("average")}</dt>
            <dd className="font-mono text-sm font-medium tabular-nums">
              {format.number(REPORT_AVERAGE)}
            </dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter className="justify-between gap-4 border-t">
        <p className="flex items-center gap-2 text-sm">
          <HugeIcons className="text-success" icon={CheckmarkCircle02Icon} />
          {t("demo-report-signed")}
        </p>
        <div className="overflow-hidden rounded-lg">
          <QrImage label={t("reports-scan-code")} size="card" text={address} />
        </div>
      </CardFooter>
    </Card>
  );
}

/** The four corners of the camera's frame, which hold the code while the phone reads it. */
function ScanCorners() {
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <span className="border-nina-face absolute top-0 left-0 size-4 rounded-tl-lg border-t-2 border-l-2" />
      <span className="border-nina-face absolute top-0 right-0 size-4 rounded-tr-lg border-t-2 border-r-2" />
      <span className="border-nina-face absolute bottom-0 left-0 size-4 rounded-bl-lg border-b-2 border-l-2" />
      <span className="border-nina-face absolute right-0 bottom-0 size-4 rounded-br-lg border-r-2 border-b-2" />
    </div>
  );
}

/**
 * A phone that scans the report card's code, again and again while a reader
 * watches: its camera holds the code, a line of light reads it, and the
 * answer rises from the bottom of the screen: the card is real, and whose it
 * is.
 */
function ScanPhone() {
  const t = useTranslations("SchoolSite");
  const format = useFormatter();
  const address = useDemoAddress();
  const phone = useFlowPlay(composeScan);

  return (
    <div
      className="rise-on-scroll bg-card ring-foreground/10 w-56 justify-self-center rounded-4xl p-2.5 shadow-xs ring-1 [--rise-delay:25%]"
      ref={phone}
    >
      <div className="bg-nina-ink text-nina-face [container-type:size] relative grid aspect-9/16 content-center justify-items-center overflow-hidden rounded-3xl pb-20">
        <div className="relative p-3">
          <ScanCorners />
          {/* The camera shows the report card's own code, which the card beside it already names. */}
          <div
            aria-hidden="true"
            className="[container-type:size] relative size-24 overflow-hidden rounded-lg"
          >
            <QrImage
              label={t("reports-scan-code")}
              size="card"
              text={address}
            />
            <div
              className="bg-success pointer-events-none absolute inset-x-0 top-0 h-0.5 translate-y-[calc(var(--scan,0)*100cqh)] opacity-0"
              data-beam=""
            />
          </div>
        </div>
        <div
          className="bg-card text-card-foreground absolute inset-x-2 bottom-2 flex translate-y-[calc(var(--hide)*120%)] items-center gap-2.5 rounded-2xl p-2.5"
          data-answer=""
          style={HIDDEN}
        >
          <PersonAvatar mascot={DEMO_REPORTED.mascot} size="sm" />
          <div className="grid min-w-0 flex-1 gap-0.5">
            <p className="truncate text-sm font-medium">{DEMO_REPORTED.name}</p>
            <p className="text-success flex items-center gap-1 text-xs font-medium">
              <HugeIcons icon={CheckmarkCircle02Icon} size="sm" />
              {t("reports-verified")}
            </p>
          </div>
          <span className="font-mono text-sm font-medium tabular-nums">
            {format.number(REPORT_AVERAGE)}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * The reports part: under Nina, who stamps, and her words, the report card
 * a school signs beside a phone that scans its code, so a report is one scan
 * away.
 */
export function SchoolReports() {
  return (
    <FeatureRow id="reports" layout="wide">
      <SchoolFeatureText feature="reports">
        <Nina act="stamping" label="" size={88} whole />
      </SchoolFeatureText>
      <FeatureProduct>
        <div className="mx-auto grid max-w-4xl items-center justify-center gap-8 md:grid-cols-[minmax(0,28rem)_auto] md:gap-12">
          <ReportCard />
          <ScanPhone />
        </div>
      </FeatureProduct>
    </FeatureRow>
  );
}
