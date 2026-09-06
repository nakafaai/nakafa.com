import {
  NAKAFA_OPENAPI_ETAG,
  NAKAFA_OPENAPI_JSON,
} from "@repo/backend/agent/openapi/document";
import { Option } from "effect";

const OPENAPI_CACHE_CONTROL = "public, max-age=3600, s-maxage=3600";
const OPENAPI_VARY = "Accept, Accept-Encoding";
const ENTITY_TAG_CHARACTERS = /^[\x21\x23-\x7e\u0080-\u00ff]*$/u;
const MAX_IF_NONE_MATCH_ELEMENTS = 32;
const OPENAPI_OPAQUE_ENTITY_TAG = NAKAFA_OPENAPI_ETAG.replace(/^W\//, "");

function skipOptionalWhitespace(value: string, start: number) {
  let index = start;
  while (value[index] === " " || value[index] === "\t") {
    index += 1;
  }
  return index;
}

/** Reads one complete quoted entity tag without interpreting commas inside it. */
function readEntityTag(value: string, start: number) {
  const tagStart = value.startsWith("W/", start) ? start + 2 : start;
  if (value[tagStart] !== '"') {
    return Option.none();
  }
  const tagEnd = value.indexOf('"', tagStart + 1);
  if (
    tagEnd === -1 ||
    !ENTITY_TAG_CHARACTERS.test(value.slice(tagStart + 1, tagEnd))
  ) {
    return Option.none();
  }
  return Option.some({
    nextIndex: tagEnd + 1,
    opaqueTag: value.slice(tagStart, tagEnd + 1),
  });
}

/** Checks bounded If-None-Match values using weak entity-tag comparison. */
function hasWeakEntityTagMatch(ifNoneMatch: string | undefined) {
  if (ifNoneMatch === undefined) {
    return false;
  }

  const firstIndex = skipOptionalWhitespace(ifNoneMatch, 0);
  if (
    ifNoneMatch[firstIndex] === "*" &&
    skipOptionalWhitespace(ifNoneMatch, firstIndex + 1) === ifNoneMatch.length
  ) {
    return true;
  }

  let elementCount = 0;
  let hasMatch = false;
  let index = 0;
  while (index < ifNoneMatch.length) {
    index = skipOptionalWhitespace(ifNoneMatch, index);
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
    const tag = readEntityTag(ifNoneMatch, index);
    if (Option.isNone(tag)) {
      return false;
    }
    hasMatch ||= tag.value.opaqueTag === OPENAPI_OPAQUE_ENTITY_TAG;
    index = skipOptionalWhitespace(ifNoneMatch, tag.value.nextIndex);
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

/** Builds the canonical OpenAPI response. */
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

/** Builds the read-only CORS preflight for the OpenAPI document. */
export function createOpenApiOptionsResponse() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Headers": "Accept, If-None-Match",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      Vary: OPENAPI_VARY,
    },
    status: 204,
  });
}
