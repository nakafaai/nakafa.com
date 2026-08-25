import {
  NAKAFA_OPENAPI_ETAG,
  NAKAFA_OPENAPI_JSON,
} from "@repo/backend/agent/openapi/document";

const OPENAPI_CACHE_CONTROL = "public, max-age=3600, s-maxage=3600";
const OPENAPI_VARY = "Accept, Accept-Encoding";
const ENTITY_TAG_CHARACTERS = /^[\x21\x23-\x7e\u0080-\u00ff]*$/u;
const MAX_IF_NONE_MATCH_ELEMENTS = 32;
const OPENAPI_OPAQUE_ENTITY_TAG = NAKAFA_OPENAPI_ETAG.replace(/^W\//, "");

function isOptionalWhitespace(character: string) {
  return character === " " || character === "\t";
}

function hasWeakEntityTagMatch(ifNoneMatch: string | undefined) {
  if (ifNoneMatch === undefined) {
    return false;
  }

  let firstIndex = 0;
  let lastIndex = ifNoneMatch.length;

  while (isOptionalWhitespace(ifNoneMatch[firstIndex] ?? "")) {
    firstIndex += 1;
  }
  while (isOptionalWhitespace(ifNoneMatch[lastIndex - 1] ?? "")) {
    lastIndex -= 1;
  }

  if (ifNoneMatch.slice(firstIndex, lastIndex) === "*") {
    return true;
  }

  let elementCount = 0;
  let hasMatch = false;
  let index = 0;

  while (index < ifNoneMatch.length) {
    while (isOptionalWhitespace(ifNoneMatch[index] ?? "")) {
      index += 1;
    }

    if (index === ifNoneMatch.length) {
      break;
    }

    elementCount += 1;
    if (elementCount > MAX_IF_NONE_MATCH_ELEMENTS) {
      return false;
    }

    if (ifNoneMatch[index] === ",") {
      index += 1;
      continue;
    }

    if (ifNoneMatch.startsWith("W/", index)) {
      index += 2;
    }
    if (ifNoneMatch[index] !== '"') {
      return false;
    }

    const opaqueTagStart = index;
    const opaqueTagEnd = ifNoneMatch.indexOf('"', opaqueTagStart + 1);
    if (opaqueTagEnd === -1) {
      return false;
    }

    const opaqueValue = ifNoneMatch.slice(opaqueTagStart + 1, opaqueTagEnd);
    if (!ENTITY_TAG_CHARACTERS.test(opaqueValue)) {
      return false;
    }

    const opaqueTag = ifNoneMatch.slice(opaqueTagStart, opaqueTagEnd + 1);
    hasMatch ||= opaqueTag === OPENAPI_OPAQUE_ENTITY_TAG;
    index = opaqueTagEnd + 1;

    while (isOptionalWhitespace(ifNoneMatch[index] ?? "")) {
      index += 1;
    }
    if (index === ifNoneMatch.length) {
      break;
    }
    if (ifNoneMatch[index] !== ",") {
      return false;
    }
    index += 1;
  }

  return hasMatch;
}

/** Builds the canonical OpenAPI response shared by Convex and local Next. */
export function createOpenApiResponse(ifNoneMatch?: string) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "ETag",
    "Cache-Control": OPENAPI_CACHE_CONTROL,
    ETag: NAKAFA_OPENAPI_ETAG,
    Vary: OPENAPI_VARY,
  };

  if (hasWeakEntityTagMatch(ifNoneMatch)) {
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
