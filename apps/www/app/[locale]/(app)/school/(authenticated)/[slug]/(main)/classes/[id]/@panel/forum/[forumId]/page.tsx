import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { SchoolClassesForumPanel } from "@/components/school/classes/forum/panel";

export default async function Page({
  params,
}: {
  params: Promise<{ forumId: Id<"schoolClassForums"> }>;
}) {
  const { forumId } = await params;

  return <SchoolClassesForumPanel forumId={forumId} />;
}
