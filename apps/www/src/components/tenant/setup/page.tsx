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
import { LayoutContent, PageFrame } from "@/components/shared/content/frame";
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
    <PageFrame width="column">
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
        <SetupStep done={false}>
          <SetupText
            description={t("setup-plan-description")}
            title={t("setup-plan")}
          />
          <TargetLink
            className={buttonVariants({ size: "sm", variant: "outline" })}
            target={settings("/school/$slug/settings/billing")}
          >
            {t("setup-open")}
          </TargetLink>
        </SetupStep>
        <SetupStep done={false}>
          <SetupText
            description={t("setup-country-description")}
            title={t("setup-country")}
          >
            <SetupCountry />
          </SetupText>
          <TargetLink
            className={buttonVariants({ size: "sm", variant: "outline" })}
            target={settings("/school/$slug/settings/profile")}
          >
            {t("setup-open")}
          </TargetLink>
        </SetupStep>
        <SetupStep
          done={Option.exists(done, (state) => state.period && state.cohort)}
        >
          <SetupText
            description={t("setup-period-description")}
            title={t("setup-period")}
          />
          <TargetLink
            className={buttonVariants({ size: "sm", variant: "outline" })}
            target={settings("/school/$slug/settings/periods")}
          >
            {t("setup-open")}
          </TargetLink>
        </SetupStep>
        <SetupStep done={Option.exists(done, (state) => state.student)}>
          <SetupText
            description={t("setup-import-description")}
            title={t("setup-import")}
          />
          <TargetLink
            className={buttonVariants({ size: "sm", variant: "outline" })}
            target={settings("/school/$slug/settings/roster")}
          >
            {t("setup-open")}
          </TargetLink>
        </SetupStep>
        <SetupStep done={false}>
          <SetupText
            description={t("setup-policies-description")}
            title={t("setup-policies")}
          />
          <TargetLink
            className={buttonVariants({ size: "sm", variant: "outline" })}
            target={settings("/school/$slug/settings/policies")}
          >
            {t("setup-open")}
          </TargetLink>
        </SetupStep>
        <SetupStep done={Option.exists(done, (state) => state.exam)}>
          <SetupText
            description={t("setup-exam-description")}
            title={t("setup-exam")}
          />
          <TargetLink
            className={buttonVariants({ size: "sm", variant: "outline" })}
            target={{
              from: LOCALE_ROUTE,
              params: { slug },
              to: "/school/$slug/exams",
            }}
          >
            {t("setup-open")}
          </TargetLink>
        </SetupStep>
      </LayoutContent>
    </PageFrame>
  );
}

/** One step: its state, and what its caller composes beside it. */
function SetupStep({ children, done }: { children: ReactNode; done: boolean }) {
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
      {children}
    </section>
  );
}

/** What a step is for, with anything more it shows under its words. */
function SetupText({
  children,
  description,
  title,
}: {
  children?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="text-muted-foreground text-sm text-pretty">{description}</p>
      {children}
    </div>
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
