"use client";

import { QueryResult, useQuery } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, Suspense } from "react";
import { SchoolClassesDetailPanel } from "@/components/school/classes/detail";
import { ForumPostConversation } from "@/components/school/classes/forum/conversation/shell";
import { SchoolClassesForumPanelInfo } from "@/components/school/classes/forum/panel/info";
import { getSchoolClassesForumHref } from "@/components/school/classes/forum/routes";
import { DataFailure } from "@/components/shared/failure";
import { useViewer } from "@/lib/identity/client";

/**
 * Render the active forum conversation inside the reusable class detail slot,
 * routing back to the forum feed when the panel closes.
 */
export function SchoolClassesForumPanel({
  forumId,
}: {
  forumId: Id<"schoolClassForums">;
}) {
  return (
    <Suspense fallback={null}>
      <SchoolClassesForumPanelFrame forumId={forumId} />
    </Suspense>
  );
}

/** Resolve live route state and render the loaded forum panel frame. */
function SchoolClassesForumPanelFrame({
  forumId,
}: {
  forumId: Id<"schoolClassForums">;
}) {
  const t = useTranslations("School.Classes");
  const user = useViewer((state) => state.account);
  const router = useRouter();
  const { id: classRouteId, slug } = useParams<{
    id: string;
    slug: string;
  }>();
  const searchParams = useSearchParams();
  const query = useQuery(refs.public.classes.forums.queries.forums.getForum, {
    forumId,
  });
  const forum = QueryResult.isSuccess(query) ? query.value : undefined;
  const closeHref = getSchoolClassesForumHref({
    classRouteId,
    queryString: searchParams.toString(),
    slug,
  });

  /** Returns to the forum list while preserving per-forum composer state. */
  function handleClose() {
    router.replace(closeHref);
  }

  let content: ReactNode = null;
  if (QueryResult.isFailure(query)) {
    content = <DataFailure />;
  } else if (user) {
    content = (
      <ForumPostConversation
        currentUserId={user.appUser._id}
        forum={forum}
        forumId={forumId}
      />
    );
  }

  return (
    <ErrorBoundary
      fallback={null}
      onError={() => {
        handleClose();
      }}
    >
      <SchoolClassesDetailPanel
        description={t("forum-panel-description")}
        onClose={handleClose}
        title={<SchoolClassesForumPanelInfo forum={forum} />}
      >
        {content}
      </SchoolClassesDetailPanel>
    </ErrorBoundary>
  );
}
