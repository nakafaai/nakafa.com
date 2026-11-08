import {
  Certificate01Icon,
  ChartBarLineIcon,
  Task01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Nina } from "@repo/design-system/components/ui/nina";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { DEMO_CHILD } from "@/components/marketing/school/features/cast";
import { stepVariants } from "@/components/marketing/school/features/step";
import { SchoolFeatureText } from "@/components/marketing/school/features/text";
import { FeatureCard, FeatureRow } from "@/components/marketing/shared/feature";

/** One line of the parent's view: the icon of what it is about, its name, and its value. */
function ParentLine({
  children,
  icon,
  label,
  step,
}: {
  children: ReactNode;
  icon: IconSvgElement;
  label: string;
  step: 1 | 2 | 3;
}) {
  return (
    <li
      className={stepVariants({
        className:
          "flex min-h-12 items-center gap-3 rounded-lg border px-4 py-2",
        step,
      })}
    >
      <HugeIcons className="text-muted-foreground size-4" icon={icon} />
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      {children}
    </li>
  );
}

/**
 * The parents row: what a parent sees of their own child, the tasks due this
 * week, the latest grade and the report card once it is ready.
 */
export function SchoolParents() {
  const t = useTranslations("SchoolSite");
  const tSubject = useTranslations("Subject");

  return (
    <FeatureRow id="parents" layout="end">
      <SchoolFeatureText feature="parents">
        <Nina act="waving" label="" size={88} whole />
      </SchoolFeatureText>
      <FeatureCard>
        <div className="flex items-center gap-3">
          <PersonAvatar mascot={DEMO_CHILD.mascot} size="lg" />
          <div className="grid min-w-0 gap-0.5">
            <p className="truncate font-medium">{DEMO_CHILD.name}</p>
            <p className="text-muted-foreground truncate text-sm">10A</p>
          </div>
        </div>
        <ul className="grid gap-3">
          <ParentLine icon={Task01Icon} label={t("demo-parent-due")} step={1}>
            <span className="text-sm font-medium tabular-nums">2</span>
          </ParentLine>
          <ParentLine
            icon={ChartBarLineIcon}
            label={t("demo-parent-grade")}
            step={2}
          >
            <span className="text-sm tabular-nums">
              {tSubject("physics")} 92
            </span>
          </ParentLine>
          <ParentLine
            icon={Certificate01Icon}
            label={t("demo-parent-report")}
            step={3}
          >
            <Badge variant="success">{t("demo-parent-ready")}</Badge>
          </ParentLine>
        </ul>
      </FeatureCard>
    </FeatureRow>
  );
}
