/** Primary application site URL used for auth callbacks and checkout returns. */
export const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

/** Canonical origin derived from the primary site URL. */
export const siteOrigin = new URL(siteUrl).origin;
