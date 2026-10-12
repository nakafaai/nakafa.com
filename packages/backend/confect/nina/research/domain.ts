import { Option, Predicate, pipe, String as Str } from "effect";
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

/**
 * Reads the hostname of an address, or of a host written without a scheme, with
 * the platform `URL` (`fromUrl` of parse-domain adds the scheme a bare host
 * lacks). The hostname is lower case, in punycode when it is not ASCII, and has
 * no login, port, path, or query. Text that has no hostname gives none.
 */
export function extractHostname(address: string) {
  return pipe(
    fromUrl(address),
    Option.liftPredicate(Predicate.isString),
    Option.filter(Str.isNonEmpty)
  );
}
