import { Config, Effect, Option, Schema } from "effect";

const NAKAFA_HOSTNAME = "nakafa.com";
const DEVELOPMENT_ENVIRONMENT = "development";
const developmentOrigins = new Set([
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
]);
const corsEnvironment = Config.all({
  nodeEnvironment: Config.string("NODE_ENV").pipe(
    Config.withDefault("production")
  ),
  vercelTargetEnvironment: Config.string("VERCEL_TARGET_ENV").pipe(
    Config.withDefault("")
  ),
});
const decodeUrl = Schema.decodeUnknownOption(Schema.URLFromString);

/** Reports whether one parsed URL belongs to an allowed Nakafa origin. */
function isAllowedUrl(url: URL, allowDevelopmentOrigins: boolean) {
  if (allowDevelopmentOrigins && developmentOrigins.has(url.origin)) {
    return true;
  }
  if (url.protocol !== "https:" || url.port !== "") {
    return false;
  }
  return (
    url.hostname === NAKAFA_HOSTNAME ||
    url.hostname.endsWith(`.${NAKAFA_HOSTNAME}`)
  );
}

/** Decodes and validates one untrusted Origin or Referer header. */
function isAllowedHeader(value: string, allowDevelopmentOrigins: boolean) {
  const decoded = decodeUrl(value);
  if (Option.isNone(decoded)) {
    return false;
  }
  return isAllowedUrl(decoded.value, allowDevelopmentOrigins);
}

/**
 * Validates the authoritative browser origin for a WWW API request.
 *
 * Origin takes precedence when present. Referer is consulted only for
 * same-origin requests whose browser omitted Origin.
 */
export const isCorsRequestAllowed = Effect.fn("security.cors.isRequestAllowed")(
  function* (request: Request) {
    const environment = yield* corsEnvironment;
    const allowDevelopmentOrigins =
      environment.nodeEnvironment === DEVELOPMENT_ENVIRONMENT ||
      environment.vercelTargetEnvironment === DEVELOPMENT_ENVIRONMENT;
    const origin = request.headers.get("origin");
    if (origin !== null) {
      return isAllowedHeader(origin, allowDevelopmentOrigins);
    }
    const referer = request.headers.get("referer");
    if (referer === null) {
      return false;
    }
    return isAllowedHeader(referer, allowDevelopmentOrigins);
  }
);

/** Creates the uniform response for a rejected browser origin. */
export function createCorsForbiddenResponse() {
  return new Response("Access denied.", {
    headers: { "Content-Type": "text/plain" },
    status: 403,
  });
}
