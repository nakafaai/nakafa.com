import { SITE_ORIGIN } from "@repo/seo/origin";
import { profileHref } from "@/lib/profile/href";

/** The absolute address of a profile in one locale, which sharing copies or sends. */
export function profileUrl(locale: string, username: string) {
  return new URL(`/${locale}${profileHref(username)}`, SITE_ORIGIN).href;
}

/**
 * Whether a share ended because the learner closed the share sheet. Closing it
 * is no failure, so it is not reported.
 */
export function isShareCancel(cause: unknown) {
  return cause instanceof DOMException && cause.name === "AbortError";
}
