import { QueryResult } from "@confect/react";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { linkOptions } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { CardLink, CardLinks } from "@/components/shared/card/link";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import { homeSetupRead, useHomeSetup } from "@/components/tenant/home/query";
import { missingSteps, type SetupStep } from "@/components/tenant/home/steps";
import { HomeTile, RowText, TILE_ROWS } from "@/components/tenant/home/tile";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import type { LinkTarget } from "@/lib/routing/link";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

/** The settings page where each step is completed, under the school's slug. */
const STEP_TARGET: Record<SetupStep, (slug: TenantSlug) => LinkTarget> = {
  invites: (slug) =>
    linkOptions({
      from: LOCALE_ROUTE,
      params: { slug },
      to: "/school/$slug/settings/invites",
    }),
  students: (slug) =>
    linkOptions({
      from: LOCALE_ROUTE,
      params: { slug },
      to: "/school/$slug/settings/students",
    }),
  teacher: (slug) =>
    linkOptions({
      from: LOCALE_ROUTE,
      params: { slug },
      to: "/school/$slug/settings/invites",
    }),
  unit: (slug) =>
    linkOptions({
      from: LOCALE_ROUTE,
      params: { slug },
      to: "/school/$slug/settings/units",
    }),
};

/**
 * The steps that the school still lacks, once both the setup read and the viewer's units have answered. Until
 * then no step shows, so the tile is absent rather than a guess.
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
 * Whether the setup tile shows on the staff home. Only the owner and the admin see it, while a step is missing or
 * the setup read has failed, so the failure shows inside the tile with its own Try again.
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
 * The setup tile: one row for each step that the school still lacks, up to the rows a tile shows, each opening
 * the settings page that completes it. A failed read shows its own sentence and Try again inside this tile,
 * which keeps its title and footer.
 */
export function SetupTile({ className }: { className?: string | undefined }) {
  const t = useTranslations("School");
  const tenant = useTenant();

  return (
    <ReadBoundary
      fallback={(failure) => (
        <HomeTile
          className={className}
          hint={t("tile-setup-footer")}
          title={t("tile-setup")}
        >
          {failure}
        </HomeTile>
      )}
      read={homeSetupRead(tenant.slug)}
    >
      <SetupRows className={className} />
    </ReadBoundary>
  );
}

/** The setup tile's rows, read from the setup read and the viewer's units. */
function SetupRows({ className }: { className?: string | undefined }) {
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
  return (
    <HomeTile
      className={className}
      hint={t("tile-setup-footer")}
      title={t("tile-setup")}
    >
      <CardLinks>
        {Arr.map(Arr.take(steps, TILE_ROWS), (step) => (
          <SetupRow key={step} step={step} />
        ))}
      </CardLinks>
    </HomeTile>
  );
}

/**
 * One missing step, as a row that opens the settings page that completes it. Its arrow shows at all times, since the
 * row has no other text, and without the arrow it would read as plain text.
 */
function SetupRow({ step }: { step: SetupStep }) {
  const tenant = useTenant();
  const t = useTranslations("School");
  const title = t(`setup-${step}`);

  return (
    <CardLink
      arrow="always"
      target={STEP_TARGET[step](tenant.slug)}
      title={title}
    >
      <RowText title={title} />
    </CardLink>
  );
}
