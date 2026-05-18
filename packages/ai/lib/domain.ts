import { fromUrl, ParseResultType, parseDomain } from "parse-domain";

/**
 * Returns the registrable domain label used for compact source citations.
 */
export function extractDomain(url: string) {
  const result = parseDomain(fromUrl(url));

  if (result.type !== ParseResultType.Listed) {
    return "";
  }

  return result.domain ?? "";
}
