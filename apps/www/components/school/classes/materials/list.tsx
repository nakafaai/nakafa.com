"use client";

import { useDebouncedValue } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import { PERMISSIONS } from "@repo/backend/convex/lib/helpers/permissions";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { usePaginatedQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import {
  SchoolContentLoading,
  SchoolContentState,
} from "@/components/school/content-state";
import { useClass } from "@/lib/context/use-class";
import { useClassPermissions } from "@/lib/hooks/use-class-permissions";
import { searchParsers } from "@/lib/nuqs/search";
import { MaterialGroupCard } from "./item";

const DEBOUNCE_TIME = 500;

/** Render the paginated material-group list for the active class. */
export function SchoolClassesMaterialsList() {
  const t = useTranslations("School.Classes");
  const tCommon = useTranslations("School.Common");

  const [{ q }] = useQueryStates(searchParsers);

  const classId = useClass((state) => state.class._id);
  const { can } = useClassPermissions();

  const [debouncedQ] = useDebouncedValue(q, DEBOUNCE_TIME);

  const { results, status, loadMore } = usePaginatedQuery(
    api.classes.materials.queries.getMaterialGroups,
    {
      classId,
      q: debouncedQ,
    },
    { initialNumItems: 50 }
  );

  const canManage = can(PERMISSIONS.CONTENT_EDIT);

  if (status === "LoadingFirstPage") {
    return (
      <SchoolContentLoading
        description={tCommon("loading-content-description")}
        title={tCommon("loading-content")}
      />
    );
  }

  if (results.length === 0) {
    return (
      <SchoolContentState
        description={t("new-module-description")}
        title={t("no-materials-found")}
      />
    );
  }

  return (
    <div className="flex flex-col">
      <section className="flex flex-col divide-y overflow-hidden rounded-md border shadow-sm">
        {results.map((group) => (
          <MaterialGroupCard
            canManage={canManage}
            group={group}
            key={group._id}
          />
        ))}
      </section>
      {status === "CanLoadMore" && (
        <Intersection onIntersect={() => loadMore(25)} />
      )}
    </div>
  );
}
