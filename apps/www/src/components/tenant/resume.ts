import { SITE_ORIGIN } from "@repo/seo/origin";

/** The query switch that opens a school's username form, `?masuk=username`. */
const USERNAME_FORM = "masuk";

/**
 * Where a sign-in on a school host resumes: the page the visitor is on, with the rest of its query,
 * so a student who scanned an exam room's code lands back in the room. The switch of the username
 * form goes, since the visitor is signed in now, and so does the part after the `#`: a scanned code
 * waits in the tab's session storage instead, so it never reaches a server in a return address.
 */
export function signInReturn(href: string) {
  const address = new URL(href, SITE_ORIGIN);
  address.searchParams.delete(USERNAME_FORM);
  return `${address.pathname}${address.search}`;
}
