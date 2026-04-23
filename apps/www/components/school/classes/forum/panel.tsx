"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useQuery } from "convex/react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SchoolClassesDetailPanel } from "@/components/school/classes/detail-panel";
import { useSession } from "@/components/school/classes/forum/conversation/context/use-session";
import { SchoolClassesForumPanelContent } from "@/components/school/classes/forum/panel-content";
import { SchoolClassesForumPanelError } from "@/components/school/classes/forum/panel-error";
import { SchoolClassesForumPanelInfo } from "@/components/school/classes/forum/panel-info";

/**
 * Render the active forum conversation inside the reusable class detail slot,
 * routing back to the forum feed when the panel closes.
 */
export function SchoolClassesForumPanel({
  forumId,
}: {
  forumId: Id<"schoolClassForums">;
}) {
  const t = useTranslations("School.Classes");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id, slug } = useParams<{ id: string; slug: string }>();
  const setReplyTo = useSession((state) => state.setReplyTo);
  const forum = useQuery(api.classes.forums.queries.forums.getForum, {
    forumId,
  });
  const search = searchParams.toString();
  const closeHref = `/school/${slug}/classes/${id}/forum${search ? `?${search}` : ""}`;

  /** Clears reply state before returning to the forum list. */
  function handleClose() {
    setReplyTo(null);
    router.replace(closeHref);
  }

  return (
    <ErrorBoundary
      fallback={<SchoolClassesForumPanelError />}
      onError={() => {
        handleClose();
      }}
    >
      <SchoolClassesDetailPanel
        description={t("forum-panel-description")}
        onClose={handleClose}
        title={<SchoolClassesForumPanelInfo forum={forum} />}
      >
        <SchoolClassesForumPanelContent forum={forum} forumId={forumId} />
      </SchoolClassesDetailPanel>
    </ErrorBoundary>
  );
}
