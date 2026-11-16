import {
  Certificate01Icon,
  QrCodeIcon,
  Task01Icon,
} from "@hugeicons/core-free-icons";
import { AnimalFigure } from "@repo/design-system/components/ui/animal";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
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
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr } from "effect";
import { useState } from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import {
  DEMO_CHILD,
  DEMO_PARENT,
} from "@/components/marketing/school/features/cast";
import { stepVariants } from "@/components/marketing/school/features/step";
import { SchoolFeatureText } from "@/components/marketing/school/features/text";
import {
  FeatureProduct,
  FeatureRow,
} from "@/components/marketing/shared/feature";
import { QrImage } from "@/components/shared/qr/image";

/** The child's tasks of the week as a parent reads them: each task's title, where it stands, and how that reads. */
const CHILD_TASKS = [
  { state: "handed", step: 1, title: "title", variant: "success" },
  { state: "handed", step: 2, title: "essay", variant: "success" },
  { state: "tomorrow", step: 3, title: "lab", variant: "warning" },
  { state: "friday", step: 4, title: "quiz", variant: "muted-outline" },
] as const;

/** The child's latest grades, one for each subject. */
const CHILD_GRADES = [
  { score: 90, step: 1, subject: "mathematics" },
  { score: 92, step: 2, subject: "physics" },
  { score: 86, step: 3, subject: "chemistry" },
  { score: 94, step: 4, subject: "biology" },
] as const;

/** The child's week: every task, and whether it is handed in or when it is due. */
function ChildTasks() {
  const t = useTranslations("SchoolSite");

  return (
    <section className="grid content-start gap-3">
      <h3 className="text-muted-foreground text-sm">{t("parents-tasks")}</h3>
      <ul className="grid gap-3">
        {Arr.map(CHILD_TASKS, ({ state, step, title, variant }) => (
          <li
            className={stepVariants({
              className: "flex min-h-8 items-center gap-3",
              step,
            })}
            key={title}
          >
            <HugeIcons className="text-muted-foreground" icon={Task01Icon} />
            <span className="min-w-0 flex-1 truncate text-sm">
              {t(`demo-task-${title}`)}
            </span>
            <Badge variant={variant}>{t(`demo-parent-${state}`)}</Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The child's grades, one line for each subject. */
function ChildGrades() {
  const tCommon = useTranslations("Common");
  const tSubject = useTranslations("Subject");
  const format = useFormatter();

  return (
    <section className="grid content-start gap-3">
      <h3 className="text-muted-foreground text-sm">{tCommon("grades")}</h3>
      <dl className="grid gap-3">
        {Arr.map(CHILD_GRADES, ({ score, step, subject }) => (
          <div
            className={stepVariants({
              className: "flex min-h-8 items-center justify-between gap-4",
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
      </dl>
    </section>
  );
}

/**
 * The report card in the footer of a parent's view: that it is ready, and the
 * button that opens the code a phone scans to read the signed copy.
 */
function ChildReport() {
  const t = useTranslations("SchoolSite");
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <>
      <p className="flex min-w-0 items-center gap-2 text-sm">
        <HugeIcons className="text-muted-foreground" icon={Certificate01Icon} />
        <span className="truncate">{t("demo-parent-ready")}</span>
      </p>
      <Button onClick={() => setOpen(true)} variant="outline">
        <HugeIcons icon={QrCodeIcon} />
        {t("parents-scan")}
      </Button>
      <ResponsiveDialog
        description={t("parents-scan-lead")}
        open={open}
        setOpen={setOpen}
        title={t("parents-scan-title", { name: DEMO_CHILD.name })}
      >
        <div className="grid justify-items-center">
          <QrImage
            label={t("reports-scan-code")}
            size="room"
            text={`${SITE_ORIGIN}/${locale}/school#parents`}
          />
        </div>
      </ResponsiveDialog>
    </>
  );
}

/**
 * The parents part: under Nina, who waves, and her words, a parent and their
 * child looking over the one view the parent has: the child's week beside the
 * child's grades, and the report card one scan away in its footer.
 */
export function SchoolParents() {
  return (
    <FeatureRow id="parents" layout="wide">
      <SchoolFeatureText feature="parents">
        <Nina act="strolling" label="" size={88} whole />
      </SchoolFeatureText>
      <FeatureProduct>
        <div className="rise-on-scroll relative mx-auto max-w-3xl pt-24 [--rise-delay:15%] sm:pt-32">
          <div className="absolute start-6 top-0 flex h-24 items-end sm:start-10 sm:h-32">
            <AnimalFigure className="h-full w-auto" mascot={DEMO_PARENT} />
            <AnimalFigure
              className="-ms-4 h-3/5 w-auto"
              mascot={DEMO_CHILD.mascot}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{DEMO_CHILD.name}</CardTitle>
              <CardDescription>10A</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-x-10 gap-y-6 md:grid-cols-2">
              <ChildTasks />
              <ChildGrades />
            </CardContent>
            <CardFooter className="justify-between gap-3 border-t">
              <ChildReport />
            </CardFooter>
          </Card>
        </div>
      </FeatureProduct>
    </FeatureRow>
  );
}
