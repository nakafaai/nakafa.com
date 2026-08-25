import {
  NAKAFA_OPENAPI_ETAG,
  NAKAFA_OPENAPI_JSON,
} from "@repo/backend/agent/openapi/document";

const OPENAPI_CACHE_CONTROL = "public, max-age=3600, s-maxage=3600";
const OPENAPI_VARY = "Accept, Accept-Encoding";

/** Builds the canonical OpenAPI response shared by Convex and local Next. */
export function createOpenApiResponse(ifNoneMatch?: string) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": OPENAPI_CACHE_CONTROL,
    ETag: NAKAFA_OPENAPI_ETAG,
    Vary: OPENAPI_VARY,
  };

  if (ifNoneMatch === NAKAFA_OPENAPI_ETAG) {
    return new Response(null, { headers, status: 304 });
  }

  return new Response(NAKAFA_OPENAPI_JSON, {
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

/** Builds the public CORS preflight for the OpenAPI document. */
export function createOpenApiOptionsResponse() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Headers": "Accept, If-None-Match",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      Vary: OPENAPI_VARY,
    },
    status: 204,
  });
}
