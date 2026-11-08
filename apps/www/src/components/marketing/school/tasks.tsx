import { Task01Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Nina } from "@repo/design-system/components/ui/nina";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { DEMO_HANDERS } from "@/components/marketing/school/cast";
import { SchoolFeatureText } from "@/components/marketing/school/row";
import { stepVariants } from "@/components/marketing/school/step";
import { FeatureCard, FeatureRow } from "@/components/marketing/shared/feature";

/** One hand-in of the task: the student, the state of their work, and its grade once it has one. */
function HandIn({
  children,
  grade = "",
  person,
  step,
}: {
  children: ReactNode;
  grade?: string;
  person: (typeof DEMO_HANDERS)[number];
  step: 1 | 2 | 3;
}) {
  return (
    <li
      className={stepVariants({ className: "flex items-center gap-3", step })}
    >
      <PersonAvatar mascot={person.mascot} />
      <span className="min-w-0 flex-1 truncate text-sm">{person.name}</span>
      {children}
      <span className="w-8 text-right text-sm font-medium tabular-nums">
        {grade}
      </span>
    </li>
  );
}

/**
 * The tasks row: one task as its class sees it, its due time and how many
 * handed it in, and three hand-ins under it, one graded, one waiting and one
 * late.
 */
export function SchoolTasks() {
  const t = useTranslations("SchoolSite");
  const [graded, waiting, late] = DEMO_HANDERS;

  return (
    <FeatureRow id="tasks">
      <SchoolFeatureText feature="tasks">
        <Nina act="writing" label="" size={88} whole />
      </SchoolFeatureText>
      <FeatureCard>
        <div className="flex items-start justify-between gap-4 border-b pb-4">
          <div className="grid min-w-0 gap-1">
            <p className="flex min-w-0 items-center gap-2 font-medium">
              <HugeIcons icon={Task01Icon} />
              <span className="truncate">{t("demo-task-title")}</span>
            </p>
            <p className="text-muted-foreground text-sm">
              {t("demo-task-due")}
            </p>
          </div>
          <Badge className="tabular-nums" variant="secondary">
            {t("demo-task-handed", { done: 24, total: 30 })}
          </Badge>
        </div>
        <ul className="grid gap-4">
          <HandIn grade="92" person={graded} step={1}>
            <Badge variant="success">{t("demo-task-graded")}</Badge>
          </HandIn>
          <HandIn person={waiting} step={2}>
            <Badge variant="muted-outline">{t("demo-task-in")}</Badge>
          </HandIn>
          <HandIn person={late} step={3}>
            <Badge variant="destructive-subtle">{t("demo-task-late")}</Badge>
          </HandIn>
        </ul>
      </FeatureCard>
    </FeatureRow>
  );
}
