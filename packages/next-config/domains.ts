/**
 * SEO domains that redirect to nakafa.com
 */
export const SEO_DOMAINS = [
  "alternatifa.app",
  "bimbel.app",
  "pahamify.app",
  "quipper.app",
  "ruangguru.app",
  "zenius.dev",
];

export const MAIN_DOMAIN = "nakafa.com";

/**
 * Check if hostname is one of our SEO domains
 */
export function isSeoDomain(hostname: string): boolean {
  return SEO_DOMAINS.includes(hostname);
}

/**
 * Get redirect URL for a domain
 */
export function getRedirectUrl(path = "/"): string {
  return `https://${MAIN_DOMAIN}${path}`;
}

/**
 * Get all configured domains
 */
export function getAllSeoDomains() {
  return SEO_DOMAINS;
}
