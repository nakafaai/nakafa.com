import type { HomeView } from "@repo/backend/confect/exams/home/contract";
import { Button } from "@repo/design-system/components/ui/button";
import { Dashboard } from "@repo/design-system/components/ui/dashboard";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { createContext, use, useState } from "react";
import { useTranslations } from "use-intl";
import { type StoreApi, useStore } from "zustand";
import { runSittingCall } from "@/components/exams/sitting/actions";
import { ConfirmActions } from "@/components/exams/sitting/dialogs";
import { useTenant } from "@/components/tenant/context";
import type { CellSpan } from "@/components/tenant/home/cells";
import { useReleaseHomeResult } from "@/components/tenant/home/query";
import type { HomeReleases } from "@/components/tenant/home/release";
import { TargetLink } from "@/lib/routing/link";
import {
  schoolExamSittingResultsTarget,
  schoolExamsTarget,
} from "@/lib/routing/school/target";

/** One closed sitting whose results the viewer may view, as the school home holds it. */
type Result = (typeof HomeView.Type)["closed"][number];

/** The releases in flight of the school home, which the home creates once and provides. */
export const HomeReleasesContext = createContext<StoreApi<HomeReleases> | null>(
  null
);

/** Reads the home's releases. It throws outside the home, which always provides them. */
function useHomeReleases() {
  const releases = use(HomeReleasesContext);
  if (releases === null) {
    throw new Error("useHomeReleases must be used within TenantHome");
  }
  return releases;
}

/**
 * The results of the closed sittings that the viewer may view, newest first, each with its exam, its room, and whether
 * its results are released. A row opens the sitting's results page. A sitting whose results may be released shows the
 * release in its row, which asks first, because students see their answers once it is done. A list that reached its
 * bound links to every exam, where the rest of the results live.
 */
export function ResultsCell({
  bound,
  results,
  span,
}: {
  /** Whether the list reached its bound, so older results may exist. */
  bound: boolean;
  results: readonly Result[];
  span: CellSpan;
}) {
  const releases = useHomeReleases();
  const t = useTranslations("School");
  const { slug } = useTenant();
  const pending = useStore(releases, (state) => state.ids);

  return (
    <Dashboard.Cell narrow={span.narrow} wide={span.wide}>
      <Dashboard.CellHeader title={t("tile-results")}>
        {bound ? (
          <TargetLink
            className="shrink-0 text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
            target={schoolExamsTarget(slug)}
          >
            {t("all-exams")}
          </TargetLink>
        ) : null}
      </Dashboard.CellHeader>
      <Dashboard.List>
        {Arr.map(results, (result) => {
          const releasing = Arr.contains(pending, result.id);
          return (
            <ResultRow
              action={
                result.canRelease && !releasing ? (
                  <ReleaseAction releases={releases} sittingId={result.id} />
                ) : undefined
              }
              key={result.id}
              released={result.resultsReleased || releasing}
              result={result}
            />
          );
        })}
      </Dashboard.List>
    </Dashboard.Cell>
  );
}

/**
 * One closed sitting, as a row that opens its results page, with the release in the row while it may be released. The
 * status shows as the row's end text whenever the row has no release to offer.
 */
function ResultRow({
  action,
  released,
  result,
}: {
  action: ReactNode;
  released: boolean;
  result: Result;
}) {
  const { slug } = useTenant();
  const t = useTranslations("School");

  return (
    <Dashboard.Row
      action={action}
      detail={result.room}
      render={
        <TargetLink
          target={schoolExamSittingResultsTarget(
            slug,
            result.examId,
            result.id
          )}
          title={result.examTitle}
        />
      }
      title={result.examTitle}
      trailing={
        action === undefined
          ? t(released ? "tile-result-released" : "tile-result-pending")
          : undefined
      }
    />
  );
}

/**
 * The release of one sitting's results, as a button in its row. The button asks first, then releases the results at
 * once: the row shows the release while the server answers, and a refused release shows the release again.
 */
function ReleaseAction({
  releases,
  sittingId,
}: {
  releases: StoreApi<HomeReleases>;
  sittingId: Result["id"];
}) {
  const t = useTranslations("Exams");
  const { slug } = useTenant();
  const release = useReleaseHomeResult();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button" variant="outline">
        {t("release-action")}
      </Button>
      <ResponsiveDialog
        description={t("release-description")}
        footer={
          <ConfirmActions
            confirm={t("release-action")}
            onCancel={() => setOpen(false)}
            onConfirm={() => {
              setOpen(false);
              const { end, start } = releases.getState();
              start(sittingId);
              runSittingCall(() => release({ sittingId, slug })).finally(() =>
                end(sittingId)
              );
            }}
          />
        }
        open={open}
        setOpen={setOpen}
        title={t("release-title")}
      />
    </>
  );
}
