import { CONTENT_LICENSE_URL } from "@repo/seo/license";
import { SITE_ORIGIN } from "@repo/seo/origin";

/** The TDMRep file that states the reserved uses of every page, served from the site origin. */
const TDMREP_PATH = "/.well-known/tdmrep.json";

/**
 * The content use policy, one sentence a line: robots.txt states it as comments
 * and llms.txt as a list. The edge enforces the training reservation on the
 * training-only crawlers that `crawlers.ts` names.
 */
export const CONTENT_USE_POLICY = [
  `Nakafa content is licensed under ${CONTENT_LICENSE_URL}`,
  "Search engines, AI answer services and user-requested fetches may read and cite every page.",
  `Model training is reserved: ${new URL(TDMREP_PATH, SITE_ORIGIN).href}`,
] as const;
