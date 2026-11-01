/**
 * The address of the browser shell: the root document that the build prerenders
 * once (vite.config.ts, `spa`). The Worker answers every page that renders only in
 * the browser with it, a school page and a learner's signed-in screen alike, and
 * the browser fills it with the page.
 */
export const SHELL_PATH = "/_shell";

/** The element that holds the sign-in in a school's first HTML, which the page removes once it has drawn. */
export const SCHOOL_ENTRY_ID = "school-entry";

/**
 * The address of one locale's browser shell with a school's sign-in painted into it,
 * which is also where the build writes it, without its `.html` extension, so the
 * assets answer it at that address.
 */
export function schoolEntryPath(locale: string) {
  return `/_entry/school/${locale}`;
}
