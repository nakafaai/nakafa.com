/** Build the class forum feed or forum detail href with the current query string. */
export function getSchoolClassesForumHref({
  classRouteId,
  forumId,
  queryString,
  slug,
}: {
  classRouteId: string;
  forumId?: string;
  queryString: string;
  slug: string;
}) {
  const baseHref = `/school/${slug}/classes/${classRouteId}/forum`;
  const href = forumId ? `${baseHref}/${forumId}` : baseHref;

  if (!queryString) {
    return href;
  }

  return `${href}?${queryString}`;
}
