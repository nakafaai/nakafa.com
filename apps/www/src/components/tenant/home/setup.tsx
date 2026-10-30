import { QueryResult } from "@confect/react";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import { homeSetupRead, useHomeSetup } from "@/components/tenant/home/query";
import {
  HomeCard,
  HomeRow,
  HomeRowText,
  HomeSection,
} from "@/components/tenant/home/section";
import { missingSteps, type SetupStep } from "@/components/tenant/home/steps";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import type { LinkTarget } from "@/lib/routing/link";
import { TargetLink } from "@/lib/routing/link";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

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
 * Whether the setup section shows on the staff home. Only the owner and the admin see it, while a step is missing or
 * the setup read has failed, so the failure shows inside the section with its own Try again.
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
 * The setup of a school that is not set up yet: every step it still lacks, in order, each a row that opens the settings
 * page which completes it. A finished step leaves the list, and the section leaves the home with the last one. A failed
 * read shows its own sentence and Try again under the section's title.
 */
export function SetupSection() {
  const t = useTranslations("School");
  const tenant = useTenant();

  return (
    <HomeSection title={t("home-setup")}>
      <ReadBoundary read={homeSetupRead(tenant.slug)}>
        <SetupRows />
      </ReadBoundary>
    </HomeSection>
  );
}

/** The setup's rows, read from the setup read and the viewer's units. */
function SetupRows() {
  const setup = useHomeSetup();
  const viewer = useViewerQuery();
  if (QueryResult.isFailure(setup)) {
    throw setup.error;
  }

  return (
    <HomeCard>
      {Arr.map(stepsOf(setup, viewer), (step) => (
        <SetupRow key={step} step={step} />
      ))}
    </HomeCard>
  );
}

/** One step that the school lacks, as a row that opens the settings page which completes it. */
function SetupRow({ step }: { step: SetupStep }) {
  const tenant = useTenant();
  const t = useTranslations("School");

  return (
    <HomeRow render={<TargetLink target={STEP_TARGET[step](tenant.slug)} />}>
      <HomeRowText title={t(`setup-${step}`)} />
      <HugeIcons
        className="size-4 text-muted-foreground"
        icon={ArrowRight02Icon}
      />
    </HomeRow>
  );
}
