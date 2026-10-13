import {
  Array as Arr,
  Effect,
  Option,
  Predicate,
  pipe,
  Schema,
  SchemaGetter,
  SchemaIssue,
} from "effect";
import { fromUrl, ParseResultType, parseDomain } from "parse-domain";

/**
 * Reads a hostname against the public suffix list that parse-domain carries,
 * and gives it only when it is a host on the public web. A name whose labels
 * break the letters, digits, and hyphens rule (a comma, an underscore, a
 * wildcard), an IP address, a reserved name such as localhost, and a name whose
 * last label is no listed suffix, such as a single word, give none. It is the
 * one reader of that list: citations, the links a learner writes, and the sites
 * a search names all ask it.
 */
function readPublicHost(hostname: ReturnType<typeof fromUrl>) {
  const result = parseDomain(hostname);

  return result.type === ParseResultType.Listed
    ? Option.some(result)
    : Option.none();
}

/**
 * Returns the registrable domain label used for compact source citations.
 */
export function extractDomain(url: string) {
  return pipe(
    readPublicHost(fromUrl(url)),
    Option.flatMapNullishOr((host) => host.domain),
    Option.getOrElse(() => "")
  );
}

/**
 * Checks whether a hostname names a site that someone can register, such as
 * bbc.com or kemdikbud.go.id. A public suffix alone, such as go.id or co.uk,
 * names no one site, so a link to it is not a link to a source.
 */
export function isRegistrableHostname(hostname: string) {
  return Option.exists(readPublicHost(hostname), (host) =>
    Predicate.isNotUndefined(host.domain)
  );
}

/**
 * Reads the hostname of an address, or of a host written without a scheme, with
 * the platform `URL` (`fromUrl` of parse-domain adds the scheme a bare host
 * lacks). The hostname is lower case, in punycode when it is not ASCII, and has
 * no login, port, path, query, or root dot. Text that names no host on the
 * public web gives none. A public suffix alone, such as go.id, is a host here,
 * because a search can be limited to everything under one.
 */
function extractHostname(address: string) {
  return pipe(
    readPublicHost(fromUrl(address)),
    Option.map((host) => Arr.join(host.labels, "."))
  );
}

/**
 * One site that a search is limited to: a hostname only, without a protocol or
 * a path, as the search provider documents `includeDomains`
 * (https://docs.firecrawl.dev/api-reference/endpoint/search, read on 12 October
 * 2026). An address the model writes is reduced to its hostname here, so that
 * slip costs no extra model step, and a text that names no host on the public
 * web fails the decode. It lives with the reader it calls, in a module that the
 * coverage gate measures.
 */
export const HostnameSchema = Schema.Trim.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transformEffect((text, options) =>
      Effect.fromOption(extractHostname(text)).pipe(
        Effect.mapError(
          () =>
            new SchemaIssue.InvalidValue(
              { message: "Expected a hostname, such as bbc.com." },
              text,
              options
            )
        )
      )
    ),
    encode: SchemaGetter.passthrough(),
  })
);
