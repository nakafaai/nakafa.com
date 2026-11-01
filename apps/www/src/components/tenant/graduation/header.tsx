import { QueryResult, useMutation, useQuery } from "@confect/react";
import {
  CheckmarkBadge01Icon,
  FileExportIcon,
  MoreHorizontalIcon,
  SentIcon,
} from "@hugeicons/core-free-icons";
import records from "@repo/backend/confect/_generated/refs/records";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { toast } from "@repo/design-system/lib/toast/notify";
import { getRouteApi } from "@tanstack/react-router";
import { Array as Arr, Effect, Option, Stream, Tuple } from "effect";
import { type ReactNode, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { TableSearch } from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import { GraduationDecisionDialog } from "@/components/tenant/graduation/decision";
import { saveReadiness } from "@/components/tenant/graduation/save";
import type { GraduationOverview } from "@/components/tenant/graduation/workbook";
import { SchoolHeader } from "@/components/tenant/header";
import { saveSchool } from "@/components/tenant/settings/save";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

const SOURCE = "components/tenant/graduation/header";

/** The route of one class group's graduation, whose context holds the class group's ID. */
const cohortRoute = getRouteApi("/school/$slug/graduation/$cohortId");

/** The school and the class group of the page, which every read and write names. */
export function useCohortArgs() {
  const { slug } = useTenant();
  const cohortId = cohortRoute.useRouteContext({
    select: (context) => context.cohortId,
  });
  return { cohortId, slug };
}

/**
 * The page's header: the path back to the graduation and the class group's name, the search
 * by student, the menu with the decision on graduation and the e-Ijazah export, and Issue
 * letters for the principal. The actions draw together once the class group is read, because
 * which of them the viewer holds decides where the search stands.
 */
export function CohortGraduationHeader() {
  const t = useTranslations("SchoolGraduation");
  const args = useCohortArgs();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const overview = useQuery(records.graduations.get, isSettled ? args : "skip");
  const title = QueryResult.isSuccess(overview)
    ? overview.value.cohort.name
    : "";

  return (
    <SchoolHeader
      items={[
        {
          label: t("title"),
          target: {
            from: LOCALE_ROUTE,
            params: { slug: args.slug },
            to: "/school/$slug/graduation",
          },
        },
        { label: title },
      ]}
      title={title}
    >
      {QueryResult.isSuccess(overview) ? (
        <GraduationActions overview={overview.value}>
          <TableSearch placeholder={t("search-students")} />
        </GraduationActions>
      ) : null}
    </SchoolHeader>
  );
}

/**
 * The page's actions: a menu with the decision on graduation, which only the principal records,
 * and the e-Ijazah readiness export; and Issue letters, the principal's end goal, which issues the
 * SKL of every ready student a batch at a time and says how many it issued.
 */
function GraduationActions({
  children,
  overview,
}: {
  /** The search, which joins the menu in one group. */
  children: ReactNode;
  overview: GraduationOverview;
}) {
  const t = useTranslations("SchoolGraduation");
  const common = useTranslations("Common");
  const { slug } = useTenant();
  const issue = useMutation(records.graduations.issue);
  const [isDeciding, setIsDeciding] = useState(false);
  const [isIssuing, startIssuing] = useTransition();
  const [isExporting, startExporting] = useTransition();
  const canDecide = Arr.contains(overview.can, "graduation.decide");
  const canIssue = Arr.contains(overview.can, "graduation.issue");

  // Each call issues one batch; the next starts at its cursor until the class group is done.
  const issueAll = () =>
    Effect.runPromise(
      Effect.result(
        Stream.paginate(Option.none<string>(), (cursor) =>
          Effect.tryPromise(() =>
            issue({
              cohortId: overview.cohort.id,
              cursor: Option.getOrNull(cursor),
              slug,
            })
          ).pipe(
            Effect.flatMap(Effect.fromResult),
            Effect.map((batch) =>
              Tuple.make(
                [batch.issued],
                batch.isDone
                  ? Option.none()
                  : Option.some(Option.some(batch.continueCursor))
              )
            )
          )
        ).pipe(
          Stream.runCollect,
          Effect.map((counts) => Arr.reduce(counts, 0, (a, b) => a + b))
        )
      )
    );

  const issueLetters = () =>
    startIssuing(() =>
      saveSchool(issueAll, SOURCE, (issued) => {
        toast.success({
          description:
            issued > 0
              ? "school-letters-issued.description"
              : "school-letters-none.description",
          title:
            issued > 0
              ? "school-letters-issued.title"
              : "school-letters-none.title",
        });
      })
    );

  const exportReadiness = () =>
    startExporting(() => Effect.runPromise(saveReadiness(slug, overview)));

  return (
    <>
      <ButtonGroup>
        {children}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={common("more-actions")}
                size="icon"
                variant="outline"
              >
                {isExporting ? (
                  <Spinner isLoading />
                ) : (
                  <HugeIcons icon={MoreHorizontalIcon} />
                )}
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            {canDecide ? (
              <DropdownMenuItem onClick={() => setIsDeciding(true)}>
                <HugeIcons icon={CheckmarkBadge01Icon} />
                {t("decide")}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem disabled={isExporting} onClick={exportReadiness}>
              <HugeIcons icon={FileExportIcon} />
              {t("export-readiness")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
      {canIssue ? (
        <Button
          disabled={overview.decision === null || isIssuing}
          onClick={issueLetters}
          type="button"
        >
          {isIssuing ? <Spinner isLoading /> : <HugeIcons icon={SentIcon} />}
          <span className="@max-sm/header:sr-only">{t("issue")}</span>
        </Button>
      ) : null}
      {canDecide ? (
        <GraduationDecisionDialog
          open={isDeciding}
          overview={overview}
          setOpen={setIsDeciding}
        />
      ) : null}
    </>
  );
}
