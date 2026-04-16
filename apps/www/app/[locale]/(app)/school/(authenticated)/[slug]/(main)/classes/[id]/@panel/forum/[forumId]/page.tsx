import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { SchoolClassesForumPanelSlot } from "@/components/school/classes/forum/panel-slot";

/** Render the active forum conversation as the optional class detail branch. */
export default async function Page({
  params,
}: {
  params: Promise<{ forumId: Id<"schoolClassForums"> }>;
}) {
  const { forumId } = await params;

  return <SchoolClassesForumPanelSlot forumId={forumId} />;
}
