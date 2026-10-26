import { SITE_ORIGIN } from "@repo/seo/origin";

/** The public check page of a locked report, on the main site, in the viewer's language. */
export const checkAddress = (locale: string, hash: string) =>
  new URL(`/${locale}/verify/${hash}`, SITE_ORIGIN).href;
