/** The robots rule of every school page: school pages are private, so no search engine indexes them. */
const SCHOOL_ROBOTS = "noindex,nofollow";

/**
 * The head of a school page: the school's name as its title, so the tab and the
 * history entry say which school it is, and the robots rule. Its shape is the
 * router's head entries, as the head seam maps them.
 */
export function schoolHead(name: string) {
  return {
    meta: [{ title: name }, { content: SCHOOL_ROBOTS, name: "robots" }],
  };
}
