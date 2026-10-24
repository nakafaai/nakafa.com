import { QueryResult } from "@confect/react";
import {
  ArrowRight02Icon,
  Mail01Icon,
  School01Icon,
  UserAdd01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { Dashboard } from "@repo/design-system/components/ui/dashboard";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import type { CellSpan } from "@/components/tenant/home/cells";
import { progressPercent } from "@/components/tenant/home/progress";
import { homeSetupRead, useHomeSetup } from "@/components/tenant/home/query";
import {
  missingSteps,
  SETUP_STEP_COUNT,
  type SetupStep,
} from "@/components/tenant/home/steps";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import type { LinkTarget } from "@/lib/routing/link";
import { TargetLink } from "@/lib/routing/link";
import { LOCALE_ROUTE } from "@/lib/routing/tree";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";

/** The settings page where each step is completed, under the school's slug. */
const STEP_TARGET: Record<SetupStep, (slug: TenantSlug) => LinkTarget> = {
  invites: (slug) =>
    ({
      from: LOCALE_ROUTE,
      params: { slug },
      to: "/school/$slug/settings/invites",
    }) satisfies LinkTarget,
  students: (slug) =>
    ({
      from: LOCALE_ROUTE,
      params: { slug },
      to: "/school/$slug/settings/students",
    }) satisfies LinkTarget,
  teacher: (slug) =>
    ({
      from: LOCALE_ROUTE,
      params: { slug },
      to: "/school/$slug/settings/invites",
    }) satisfies LinkTarget,
  unit: (slug) =>
    ({
      from: LOCALE_ROUTE,
      params: { slug },
      to: "/school/$slug/settings/units",
    }) satisfies LinkTarget,
};

/** The icon of each step, which its row shows at its start. */
const STEP_ICON = {
  invites: Mail01Icon,
  students: UserGroupIcon,
  teacher: UserAdd01Icon,
  unit: School01Icon,
} as const;

/**
 * The steps that the school still lacks, once both the setup read and the viewer's units have answered. Until
 * then no step shows, so the cell is absent rather than a guess.
 */
function stepsOf(
  setup: ReturnType<typeof useHomeSetup>,
  viewer: ReturnType<typeof useViewerQuery>
) {
  if (!(QueryResult.isSuccess(setup) && QueryResult.isSuccess(viewer))) {
    return [];
  }
  return missingSteps({
    hasActiveUnit: Arr.some(
      viewer.value.units,
      (unit) => unit.status === "active"
    ),
    hasPendingInvite: setup.value.hasPendingInvite,
    hasStudent: setup.value.hasStudent,
    hasTeacher: setup.value.hasTeacher,
  });
}

/**
 * Whether the setup cell shows on the staff home. Only the owner and the admin see it, while a step is missing or
 * the setup read has failed, so the failure shows inside the cell with its own Try again.
 */
export function useSetupShown() {
  const tenant = useTenant();
  const setup = useHomeSetup();
  const viewer = useViewerQuery();
  if (!tenant.canManage) {
    return false;
  }
  if (QueryResult.isFailure(setup)) {
    return true;
  }
  return stepsOf(setup, viewer).length > 0;
}

/**
 * The setup cell: a bar of the steps the school has done, and the next step as one row that opens the settings page
 * which completes it. A failed read shows its own sentence and Try again inside this cell, which keeps its title.
 */
export function SetupCell({ span }: { span: CellSpan }) {
  const t = useTranslations("School");
  const tenant = useTenant();

  return (
    <ReadBoundary
      fallback={(failure) => (
        <Dashboard.Cell narrow={span.narrow} wide={span.wide}>
          <Dashboard.CellHeader title={t("tile-setup")} />
          {failure}
        </Dashboard.Cell>
      )}
      read={homeSetupRead(tenant.slug)}
    >
      <SetupRows span={span} />
    </ReadBoundary>
  );
}

/** The setup cell's rows, read from the setup read and the viewer's units. */
function SetupRows({ span }: { span: CellSpan }) {
  const t = useTranslations("School");
  const setup = useHomeSetup();
  const viewer = useViewerQuery();
  if (QueryResult.isFailure(setup)) {
    throw setup.error;
  }
  const steps = stepsOf(setup, viewer);
  if (Arr.isReadonlyArrayEmpty(steps)) {
    return null;
  }
  const done = SETUP_STEP_COUNT - steps.length;
  const progress = t("setup-progress", { done, total: SETUP_STEP_COUNT });

  return (
    <Dashboard.Cell narrow={span.narrow} wide={span.wide}>
      <Dashboard.CellHeader title={t("tile-setup")}>
        <span className="text-muted-foreground text-sm tabular-nums">
          {progress}
        </span>
      </Dashboard.CellHeader>
      <div className="px-6">
        <Dashboard.Meter
          label={progress}
          percent={progressPercent(0, SETUP_STEP_COUNT, done)}
        />
      </div>
      <Dashboard.List>
        {Arr.map(Arr.take(steps, 1), (step) => (
          <SetupRow key={step} step={step} />
        ))}
      </Dashboard.List>
    </Dashboard.Cell>
  );
}

/** The next step that the school lacks, as a row that opens the settings page which completes it. */
function SetupRow({ step }: { step: SetupStep }) {
  const tenant = useTenant();
  const t = useTranslations("School");
  const title = t(`setup-${step}`);

  return (
    <Dashboard.Row
      icon={STEP_ICON[step]}
      render={
        <TargetLink target={STEP_TARGET[step](tenant.slug)} title={title} />
      }
      title={title}
      trailing={<HugeIcons className="size-4" icon={ArrowRight02Icon} />}
    />
  );
}
