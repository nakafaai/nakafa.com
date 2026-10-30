import { Array as Arr } from "effect";
// The Vite config imports this module, and only package imports resolve there.
import { matchesRouteTemplate, namesFile } from "#www/src/lib/routing/template";

/**
 * The try-out track, set and section templates. The build prerenders a visitor's
 * page for each, and the Worker renders a learner's own page for their request
 * (`isLearnerPage`, ADR 0038 Phase B).
 */
const LEARNER_ROUTE_TEMPLATES = [
  "/$locale/try-out/$country/$exam/$track",
  "/$locale/try-out/$country/$exam/$track/$set",
  "/$locale/try-out/$country/$exam/$track/$set/$section",
] as const;

/**
 * The folder of the client output that holds a visitor's learner pages. A page
 * there has no asset at its own address, so the address reaches the Worker, which
 * renders a learner's page and answers a visitor with this one (`readVisitorAsset`).
 */
const LEARNER_PAGE_FOLDER = "/_tryout";

/**
 * The route templates whose pages the build prerenders as static assets. Their
 * loaders read the answers that the build keeps beside the pages, so a link to one
 * navigates in the browser and no Worker renders it for a visitor. The sign-in
 * page is here too: every visitor gets its static page, and the page itself sends
 * a signed-in visitor on in the browser.
 */
export const PRERENDERED_ROUTE_TEMPLATES = [
  "/$locale",
  "/$locale/$",
  "/$locale/articles",
  "/$locale/articles/$category",
  "/$locale/articles/$category/$slug",
  "/$locale/auth",
  "/$locale/contributor",
  "/$locale/curricula",
  "/$locale/curricula/$curriculum/$",
  "/$locale/materials/$subject/$topic/$",
  "/$locale/pricing",
  "/$locale/quran",
  "/$locale/quran/$surah",
  "/$locale/try-out",
  "/$locale/try-out/$country",
  "/$locale/try-out/$country/$exam",
  ...LEARNER_ROUTE_TEMPLATES,
] as const;

/** Whether a path names a learner page itself, not a file beside it such as its `.md` twin. */
export function namesLearnerPage(pathname: string): boolean {
  return (
    !namesFile(pathname) &&
    Arr.some(LEARNER_ROUTE_TEMPLATES, (template) =>
      matchesRouteTemplate(template, pathname)
    )
  );
}

/**
 * The path under the client output where the build writes a prerendered page: a
 * learner page inside `LEARNER_PAGE_FOLDER`, and every other page at its own path.
 */
export function staticPagePath(pathname: string): string {
  return namesLearnerPage(pathname)
    ? `${LEARNER_PAGE_FOLDER}${pathname}`
    : pathname;
}
