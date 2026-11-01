import { QueryResult, useMutation, useQuery } from "@confect/react";
import { CheckmarkCircle02Icon, CircleIcon } from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@repo/design-system/components/ui/item";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { useTransition } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { LayoutContent, PageFrame } from "@/components/shared/content/frame";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { finishSetupChange } from "@/components/tenant/settings/mutation";
import { saveSchool } from "@/components/tenant/settings/save";
import { TargetLink } from "@/lib/routing/link";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

const SOURCE = "components/tenant/setup/page";

/** A code's name in the reader's language. */
const nameOf = (locale: string, type: Intl.DisplayNamesType, code: string) =>
  new Intl.DisplayNames([locale], { type }).of(code);

/**
 * The setup of a school, in the order a new Owner works: each first step with whether the
 * school's data shows it as done and the page that does it, then the defaults the school opened
 * with, which have no state because a default is already an answer. Nothing is copied here, so
 * a step changes in one place, and Finish takes the entry out of the sidebar. Finish is the main
 * action only once every first step is done.
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
  const cohorts = Option.exists(done, (found) => found.period && found.cohort);
  const students = Option.exists(done, (found) => found.student);
  const placed = Option.exists(done, (found) => found.placed);
  const classrooms = Option.exists(done, (found) => found.classroom);
  const teachers = Option.exists(done, (found) => found.teacher);
  const parents = Option.exists(done, (found) => found.parent);
  const exam = Option.exists(done, (found) => found.exam);

  return (
    <PageFrame width="column">
      <SchoolHeader items={[{ label: t("setup-title") }]}>
        <Button
          disabled={isFinishing}
          onClick={() =>
            startFinishing(() => saveSchool(() => finish({ slug }), SOURCE))
          }
          type="button"
          variant={
            Arr.every(
              [cohorts, students, placed, classrooms, teachers, parents, exam],
              (step) => step
            )
              ? "default"
              : "outline"
          }
        >
          {t("setup-finish")}
        </Button>
      </SchoolHeader>
      <LayoutContent className="flex w-full flex-col gap-6 py-6">
        <SetupGroup title={t("setup-first")}>
          <SetupStep done={cohorts}>
            <SetupText
              description={t("setup-cohorts-description")}
              title={t("setup-cohorts")}
            />
            <SetupOpen to="/school/$slug/settings/cohorts" />
          </SetupStep>
          <SetupStep done={students}>
            <SetupText
              description={t("setup-students-description")}
              title={t("setup-students")}
            />
            <SetupOpen to="/school/$slug/settings/students" />
          </SetupStep>
          <SetupStep done={placed}>
            <SetupText
              description={t("setup-placed-description")}
              title={t("setup-placed")}
            />
            <SetupOpen to="/school/$slug/settings/cohorts" />
          </SetupStep>
          <SetupStep done={classrooms}>
            <SetupText
              description={t("setup-classes-description")}
              title={t("setup-classes")}
            />
            <SetupOpen to="/school/$slug/settings/classes" />
          </SetupStep>
          <SetupStep done={teachers}>
            <SetupText
              description={t("setup-teachers-description")}
              title={t("setup-teachers")}
            />
            <SetupOpen to="/school/$slug/settings/invites" />
          </SetupStep>
          <SetupStep done={parents}>
            <SetupText
              description={t("setup-parents-description")}
              title={t("setup-parents")}
            />
            <SetupOpen to="/school/$slug/settings/guardians" />
          </SetupStep>
          <SetupStep done={exam}>
            <SetupText
              description={t("setup-exam-description")}
              title={t("setup-exam")}
            />
            <SetupOpen to="/school/$slug/exams" />
          </SetupStep>
        </SetupGroup>
        <SetupGroup title={t("setup-check")}>
          <SetupDefault>
            <SetupText
              description={t("setup-plan-description")}
              title={t("setup-plan")}
            />
            <SetupOpen to="/school/$slug/settings/billing" />
          </SetupDefault>
          <SetupDefault>
            <SetupCountry />
            <SetupOpen to="/school/$slug/settings/profile" />
          </SetupDefault>
          <SetupDefault>
            <SetupClock />
            <SetupOpen to="/school/$slug/settings/units" />
          </SetupDefault>
          <SetupDefault>
            <SetupText
              description={t("setup-policies-description")}
              title={t("setup-policies")}
            />
            <SetupOpen to="/school/$slug/settings/policies" />
          </SetupDefault>
        </SetupGroup>
      </LayoutContent>
    </PageFrame>
  );
}

/** A titled list of steps. */
function SetupGroup({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-muted-foreground text-sm font-medium">{title}</h2>
      <ItemGroup className="gap-3">{children}</ItemGroup>
    </section>
  );
}

/** One first step: its state, and what its caller composes beside it. */
function SetupStep({ children, done }: { children: ReactNode; done: boolean }) {
  const t = useTranslations("SchoolSettings");

  return (
    <Item render={<li />} variant="outline">
      <ItemMedia variant="icon">
        <HugeIcons
          aria-label={done ? t("setup-done") : undefined}
          className={done ? "text-success" : "text-muted-foreground"}
          icon={done ? CheckmarkCircle02Icon : CircleIcon}
        />
      </ItemMedia>
      {children}
    </Item>
  );
}

/** One default the school opened with, which has no state to show. */
function SetupDefault({ children }: { children: ReactNode }) {
  return (
    <Item render={<li />} variant="outline">
      {children}
    </Item>
  );
}

/** What a step is for. */
function SetupText({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <ItemContent>
      <ItemTitle>{title}</ItemTitle>
      <ItemDescription>{description}</ItemDescription>
    </ItemContent>
  );
}

/** The way to the page that does a step. */
function SetupOpen({
  to,
}: {
  to:
    | "/school/$slug/exams"
    | "/school/$slug/settings/billing"
    | "/school/$slug/settings/classes"
    | "/school/$slug/settings/cohorts"
    | "/school/$slug/settings/guardians"
    | "/school/$slug/settings/invites"
    | "/school/$slug/settings/policies"
    | "/school/$slug/settings/profile"
    | "/school/$slug/settings/students"
    | "/school/$slug/settings/units";
}) {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");

  return (
    <ItemActions>
      <TargetLink
        className={buttonVariants({ size: "sm", variant: "outline" })}
        target={{ from: LOCALE_ROUTE, params: { slug }, to }}
      >
        {t("setup-open")}
      </TargetLink>
    </ItemActions>
  );
}

/** The school's country and currency, by their names in the reader's language. */
function SetupCountry() {
  const t = useTranslations("SchoolSettings");
  const locale = useLocale();
  const viewer = useViewerQuery();
  const held = QueryResult.isSuccess(viewer)
    ? Option.some(viewer.value.tenant)
    : Option.none();

  return (
    <SetupText
      description={Option.match(held, {
        onNone: () => "",
        onSome: ({ country, currency }) =>
          `${nameOf(locale, "region", country)}, ${nameOf(locale, "currency", currency)}`,
      })}
      title={t("setup-country")}
    />
  );
}

/** The first unit's time zone and language, which set the school's clock and calendar. */
function SetupClock() {
  const t = useTranslations("SchoolSettings");
  const locale = useLocale();
  const viewer = useViewerQuery();
  const unit = QueryResult.isSuccess(viewer)
    ? Arr.head(viewer.value.units)
    : Option.none();

  return (
    <SetupText
      description={Option.match(unit, {
        onNone: () => "",
        onSome: ({ contentLanguage, timeZone }) =>
          `${timeZone}, ${nameOf(locale, "language", contentLanguage)}`,
      })}
      title={t("setup-clock")}
    />
  );
}
