import { QueryResult, useMutation, useQuery } from "@confect/react";
import { CheckmarkCircle02Icon, CircleIcon } from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { LayoutContent } from "@/components/shared/content/frame";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { finishSetupChange } from "@/components/tenant/settings/mutation";
import { saveSchool } from "@/components/tenant/settings/save";
import { type LinkTarget, TargetLink } from "@/lib/routing/link";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

const SOURCE = "components/tenant/setup/page";

/**
 * The setup of a school: each step with what it is for, whether the school's data shows it as
 * done, and the page that does it. Nothing is copied here, so a step changes in one place, and
 * Finish takes the entry out of the sidebar.
 */
export function SchoolSetup() {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const state = useQuery(tenancy.setup.state, isSettled ? { slug } : "skip");
  const finish = useMutation(tenancy.setup.finish).withOptimisticUpdate(
    finishSetupChange
  );
  const [isFinishing, startFinishing] = useTransition();
  const done = QueryResult.isSuccess(state)
    ? Option.some(state.value)
    : Option.none();
  const settings = (
    to:
      | "/school/$slug/settings/billing"
      | "/school/$slug/settings/periods"
      | "/school/$slug/settings/policies"
      | "/school/$slug/settings/profile"
      | "/school/$slug/settings/roster"
  ): LinkTarget => ({ from: LOCALE_ROUTE, params: { slug }, to });

  return (
    <>
      <SchoolHeader items={[{ label: t("setup-title") }]}>
        <Button
          disabled={isFinishing}
          onClick={() =>
            startFinishing(() => saveSchool(() => finish({ slug }), SOURCE))
          }
          type="button"
        >
          {t("setup-finish")}
        </Button>
      </SchoolHeader>
      <LayoutContent className="flex w-full flex-col gap-3 py-6">
        <SetupStep
          description={t("setup-plan-description")}
          done={false}
          target={settings("/school/$slug/settings/billing")}
          title={t("setup-plan")}
        />
        <SetupStep
          description={t("setup-country-description")}
          done={false}
          target={settings("/school/$slug/settings/profile")}
          title={t("setup-country")}
        >
          <SetupCountry />
        </SetupStep>
        <SetupStep
          description={t("setup-period-description")}
          done={Option.exists(done, (state) => state.period && state.cohort)}
          target={settings("/school/$slug/settings/periods")}
          title={t("setup-period")}
        />
        <SetupStep
          description={t("setup-import-description")}
          done={Option.exists(done, (state) => state.student)}
          target={settings("/school/$slug/settings/roster")}
          title={t("setup-import")}
        />
        <SetupStep
          description={t("setup-policies-description")}
          done={false}
          target={settings("/school/$slug/settings/policies")}
          title={t("setup-policies")}
        />
        <SetupStep
          description={t("setup-exam-description")}
          done={Option.exists(done, (state) => state.exam)}
          target={{
            from: LOCALE_ROUTE,
            params: { slug },
            to: "/school/$slug/exams",
          }}
          title={t("setup-exam")}
        />
      </LayoutContent>
    </>
  );
}

/** One step: its state, what it is for, and the page that does it. */
function SetupStep({
  children,
  description,
  done,
  target,
  title,
}: {
  children?: ReactNode;
  description: string;
  done: boolean;
  target: LinkTarget;
  title: string;
}) {
  const t = useTranslations("SchoolSettings");

  return (
    <section className="border-border flex items-start gap-3 rounded-md border p-4">
      <HugeIcons
        aria-label={done ? t("setup-done") : undefined}
        className={
          done
            ? "text-success mt-0.5 size-4"
            : "text-muted-foreground mt-0.5 size-4"
        }
        icon={done ? CheckmarkCircle02Icon : CircleIcon}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="text-muted-foreground text-sm text-pretty">
          {description}
        </p>
        {children}
      </div>
      <TargetLink
        className={buttonVariants({ size: "sm", variant: "outline" })}
        target={target}
      >
        {t("setup-open")}
      </TargetLink>
    </section>
  );
}

/** The country profile the school holds now, as one line of facts for each. */
function SetupCountry() {
  const t = useTranslations("SchoolSettings");
  const viewer = useViewerQuery();

  if (!QueryResult.isSuccess(viewer)) {
    return null;
  }
  const { tenant, units } = viewer.value;
  const unit = Arr.head(units);

  return (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
      <dt className="text-muted-foreground">{t("setup-country-name")}</dt>
      <dd>{tenant.country}</dd>
      <dt className="text-muted-foreground">{t("setup-country-currency")}</dt>
      <dd>{tenant.currency}</dd>
      {Option.isSome(unit) ? (
        <>
          <dt className="text-muted-foreground">{t("setup-country-zone")}</dt>
          <dd>{unit.value.timeZone}</dd>
          <dt className="text-muted-foreground">
            {t("setup-country-language")}
          </dt>
          <dd>{unit.value.contentLanguage}</dd>
        </>
      ) : null}
    </dl>
  );
}
