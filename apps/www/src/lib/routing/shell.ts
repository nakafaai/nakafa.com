/**
 * The address of the browser shell: the root document that the build prerenders
 * once (vite.config.ts, `spa`). The Worker answers every page that renders only in
 * the browser with it, a school page and a learner's signed-in screen alike, and
 * the browser fills it with the page.
 */
export const SHELL_PATH = "/_shell";
