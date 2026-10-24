import type { HomeView } from "@repo/backend/confect/exams/home/contract";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { CardLink, CardLinks } from "@/components/shared/card/link";
import { useTenant } from "@/components/tenant/context";
import {
  AllExamsAction,
  HomeTile,
  RowText,
  TILE_ROWS,
} from "@/components/tenant/home/tile";
import { schoolExamSittingResultsTarget } from "@/lib/routing/school/target";

/** One closed sitting whose results the viewer may view, as the school home holds it. */
type Result = (typeof HomeView.Type)["closed"][number];

/**
 * The results of the closed sittings that the viewer may view, newest first, each with its exam, its room, and
 * whether its results are released. A row opens the sitting's results page. The footer names the action of the
 * viewer when some row may be released, and otherwise says when results appear. A tile with more results than it
 * shows ends with All exams.
 */
export function ResultsTile({
  className,
  results,
}: {
  className?: string | undefined;
  results: readonly Result[];
}) {
  const t = useTranslations("School");
  const tenant = useTenant();
  const canRelease = Arr.some(results, (result) => result.canRelease);

  return (
    <HomeTile
      action={
        results.length > TILE_ROWS && tenant.canOpenExams ? (
          <AllExamsAction />
        ) : undefined
      }
      className={className}
      hint={
        canRelease ? t("tile-results-release-footer") : t("tile-results-footer")
      }
      title={t("tile-results")}
    >
      <CardLinks>
        {Arr.map(Arr.take(results, TILE_ROWS), (result) => (
          <ResultRow key={result.id} result={result} />
        ))}
      </CardLinks>
    </HomeTile>
  );
}

/** One closed sitting, as a row that opens its results page and names whether they are released. */
function ResultRow({ result }: { result: Result }) {
  const tenant = useTenant();
  const t = useTranslations("School");

  return (
    <CardLink
      target={schoolExamSittingResultsTarget(
        tenant.slug,
        result.examId,
        result.id
      )}
      title={result.examTitle}
    >
      <RowText detail={result.room} title={result.examTitle} />
      <span className="shrink-0 text-muted-foreground text-sm">
        {result.resultsReleased
          ? t("tile-result-released")
          : t("tile-result-pending")}
      </span>
    </CardLink>
  );
}
