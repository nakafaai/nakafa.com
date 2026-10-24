import type { HomeView } from "@repo/backend/confect/exams/home/contract";
import { Button } from "@repo/design-system/components/ui/button";
import { Dashboard } from "@repo/design-system/components/ui/dashboard";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Array as Arr } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { runSittingCall } from "@/components/exams/sitting/actions";
import { ConfirmActions } from "@/components/exams/sitting/dialogs";
import { useTenant } from "@/components/tenant/context";
import type { CellSpan } from "@/components/tenant/home/cells";
import { useReleaseHomeResult } from "@/components/tenant/home/query";
import { SchoolHrefLink } from "@/lib/routing/school/link";

/** One closed sitting whose results the viewer may view, as the school home holds it. */
type Result = (typeof HomeView.Type)["closed"][number];

/**
 * The results of the closed sittings that the viewer may view, newest first, each with its exam, its room, and
 * whether its results are released. A row opens the sitting's results page. A sitting whose results may be released
 * shows the release in its row, which asks first, because students see their answers once it is done.
 */
export function ResultsCell({
  results,
  span,
}: {
  results: readonly Result[];
  span: CellSpan;
}) {
  const t = useTranslations("School");

  return (
    <Dashboard.Cell three={span.three} two={span.two}>
      <Dashboard.CellHeader title={t("tile-results")} />
      <Dashboard.List>
        {Arr.map(results, (result) => (
          <ResultRow key={result.id} result={result} />
        ))}
      </Dashboard.List>
    </Dashboard.Cell>
  );
}

/** One closed sitting, as a row that opens its results page and names whether they are released, or releases them. */
function ResultRow({ result }: { result: Result }) {
  const t = useTranslations("School");

  return (
    <Dashboard.Row
      action={
        result.canRelease ? <ReleaseAction sittingId={result.id} /> : undefined
      }
      detail={result.room}
      render={
        <SchoolHrefLink
          href={`/exams/${result.examId}/sittings/${result.id}/results`}
          title={result.examTitle}
        />
      }
      title={result.examTitle}
      trailing={
        result.canRelease ? undefined : (
          <span className="shrink-0 text-muted-foreground text-sm">
            {result.resultsReleased
              ? t("tile-result-released")
              : t("tile-result-pending")}
          </span>
        )
      }
    />
  );
}

/**
 * The release of one sitting's results, as a button in its row. The button asks first, then releases the results at
 * once: the row shows the release before the server answers, and a refused release rolls it back.
 */
function ReleaseAction({ sittingId }: { sittingId: Result["id"] }) {
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
              runSittingCall(() => release({ sittingId, slug }));
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
