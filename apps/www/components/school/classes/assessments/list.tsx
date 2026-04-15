"use client";

import { File02Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { PERMISSIONS } from "@repo/backend/convex/lib/helpers/permissions";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { usePaginatedQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { useClass } from "@/lib/context/use-class";
import { useClassPermissions } from "@/lib/hooks/use-class-permissions";
import { searchParsers } from "@/lib/nuqs/search";

/** Render the first class-scoped authored assessment list. */
export function SchoolClassesAssessmentsList() {
  const t = useTranslations("School.Classes");
  const classId = useClass((state) => state.class._id);
  const schoolId = useClass((state) => state.class.schoolId);
  const { can } = useClassPermissions();
  const [{ q }] = useQueryStates(searchParsers);
  const assessmentModeLabels = {
    assignment: "assessment-mode-assignment",
    exam: "assessment-mode-exam",
    practice: "assessment-mode-practice",
    quiz: "assessment-mode-quiz",
    tryout: "assessment-mode-tryout",
  } as const;

  const canManage = can(PERMISSIONS.ASSESSMENT_UPDATE);

  const { results, status, loadMore } = usePaginatedQuery(
    api.assessments.queries.public.assessmentList.listAssessments,
    canManage
      ? {
          schoolId,
          classId,
        }
      : "skip",
    { initialNumItems: 20 }
  );

  const filteredResults = results.filter((assessment) => {
    if (!q) {
      return true;
    }

    const query = q.trim().toLowerCase();

    return (
      assessment.title.toLowerCase().includes(query) ||
      assessment.slug.toLowerCase().includes(query)
    );
  });

  if (!canManage) {
    return (
      <div className="py-12">
        <p className="text-center text-muted-foreground text-sm">
          {t("assessments-teacher-only")}
        </p>
      </div>
    );
  }

  if (status === "LoadingFirstPage") {
    return null;
  }

  if (filteredResults.length === 0) {
    return (
      <div className="py-12">
        <p className="text-center text-muted-foreground text-sm">
          {t("no-assessments-found")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <section className="flex flex-col divide-y overflow-hidden rounded-md border shadow-sm">
        {filteredResults.map((assessment) => (
          <div className="flex items-start gap-3 p-4" key={assessment._id}>
            <div className="rounded-md border p-2 text-muted-foreground">
              <HugeIcons className="size-4" icon={File02Icon} />
            </div>

            <div className="grid min-w-0 flex-1 gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="truncate font-medium">{assessment.title}</h3>
                <Badge variant="muted">
                  {t(assessmentModeLabels[assessment.mode])}
                </Badge>
                <Badge variant="outline">{t(assessment.status)}</Badge>
              </div>

              <div className="flex min-w-0 items-center gap-2 text-muted-foreground text-sm">
                <span className="truncate">/{assessment.slug}</span>
              </div>
            </div>
          </div>
        ))}
      </section>

      {status === "CanLoadMore" && (
        <Intersection onIntersect={() => loadMore(20)} />
      )}
    </div>
  );
}
