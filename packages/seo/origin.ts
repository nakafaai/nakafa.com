import { MAIN_DOMAIN } from "@repo/next-config/domains";

/**
 * The production origin of Nakafa. Every package that builds an absolute Nakafa
 * URL reads it here. It derives from the production domain in
 * `@repo/next-config/domains`, which imports nothing, so a browser bundle pays
 * for one constant and one string.
 */
export const SITE_ORIGIN = `https://${MAIN_DOMAIN}` as const;
