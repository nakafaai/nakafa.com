import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { getSchoolClassesForumHref } from "@/components/school/classes/forum/helpers/routes";
import { SchoolClassesForumPanelSlot } from "@/components/school/classes/forum/panel-slot";

/** Render the active forum conversation as the optional class detail branch. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{
    forumId: Id<"schoolClassForums">;
    id: string;
    slug: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ forumId, id, slug }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const closeHref = getSchoolClassesForumHref({
    classRouteId: id,
    queryString: getQueryString(query),
    slug,
  });

  return (
    <SchoolClassesForumPanelSlot closeHref={closeHref} forumId={forumId} />
  );
}

/** Serialize route search params so closing a forum keeps the feed filters. */
function getQueryString(params: Record<string, string | string[] | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, item);
      }
      continue;
    }

    searchParams.set(key, value);
  }

  return searchParams.toString();
}
