"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  ResizableHandle,
  ResizablePanel,
} from "@repo/design-system/components/ui/resizable";
import { SchoolClassesForumPanel } from "@/components/school/classes/forum/panel";
import {
  SCHOOL_CLASSES_WORKSPACE_DETAIL_PANEL_ID,
  useSchoolClassesWorkspaceIsCompact,
} from "@/components/school/classes/workspace-shell";

const SCHOOL_CLASSES_FORUM_PANEL_SLOT_DEFAULT_SIZE = "28rem";
const SCHOOL_CLASSES_FORUM_PANEL_SLOT_MAX_SIZE = "40rem";
const SCHOOL_CLASSES_FORUM_PANEL_SLOT_MIN_SIZE = "22rem";

/**
 * Render the forum detail slot as either a mobile sheet or the full desktop
 * resizable branch beside the class workspace.
 */
export function SchoolClassesForumPanelSlot({
  forumId,
}: {
  forumId: Id<"schoolClassForums">;
}) {
  const isCompact = useSchoolClassesWorkspaceIsCompact();

  if (isCompact) {
    return <SchoolClassesForumPanel forumId={forumId} />;
  }

  return (
    <>
      <ResizableHandle withHandle />
      <ResizablePanel
        className="min-w-0"
        defaultSize={SCHOOL_CLASSES_FORUM_PANEL_SLOT_DEFAULT_SIZE}
        groupResizeBehavior="preserve-pixel-size"
        id={SCHOOL_CLASSES_WORKSPACE_DETAIL_PANEL_ID}
        maxSize={SCHOOL_CLASSES_FORUM_PANEL_SLOT_MAX_SIZE}
        minSize={SCHOOL_CLASSES_FORUM_PANEL_SLOT_MIN_SIZE}
      >
        <SchoolClassesForumPanel forumId={forumId} />
      </ResizablePanel>
    </>
  );
}
