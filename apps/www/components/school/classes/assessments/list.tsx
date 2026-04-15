"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { PERMISSIONS } from "@repo/backend/convex/lib/helpers/permissions";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { usePaginatedQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { AssessmentCard } from "@/components/school/classes/assessments/item";
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
        <p className="text-center text-muted-foreground text-pretty text-sm">
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
        <p className="text-center text-muted-foreground text-pretty text-sm">
          {t("no-assessments-found")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <section className="flex flex-col divide-y overflow-hidden rounded-md border shadow-sm">
        {filteredResults.map((assessment) => (
          <AssessmentCard
            assessment={assessment}
            canManage={canManage}
            key={assessment._id}
          />
        ))}
      </section>

      {status === "CanLoadMore" && (
        <Intersection onIntersect={() => loadMore(20)} />
      )}
    </div>
  );
}
