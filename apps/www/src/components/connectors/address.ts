import { CALLBACK_PATH } from "@repo/backend/confect/connectors/google/manifest";

/**
 * The callback a connect names: the one of the site the visitor is on. A school
 * host such as `harapan.nakafa.com` sits under its site, so its callback is the
 * site's, `nakafa.com`, the address Google registers (ADR 0015). The server checks
 * it against the sites it serves.
 */
export const connectCallback = (
  page: { readonly host: string; readonly protocol: string },
  slug: string | null
) => {
  const prefix = slug === null ? "" : `${slug}.`;
  const site = page.host.startsWith(prefix)
    ? page.host.slice(prefix.length)
    : page.host;
  return `${page.protocol}//${site}${CALLBACK_PATH}`;
};
