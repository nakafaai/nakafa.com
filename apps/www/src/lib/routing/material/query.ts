import {
  encodeMaterialContextHint,
  MATERIAL_CONTEXT_QUERY_PARAM,
  readMaterialContextHint,
} from "@repo/contents/route/material/context";
import type { MaterialContextIdentity } from "@repo/contents/route/material/reference";
import { Effect, Option, Schema } from "effect";

/**
 * The query string of a material URL, decoded from its raw text. The `ctx` key
 * holds one text, and a value of another shape, such as a repeated key, is absent.
 */
const MaterialContextQuery = Schema.fromURLSearchParams(
  Schema.Struct({
    [MATERIAL_CONTEXT_QUERY_PARAM]: Schema.optionalKey(
      Schema.String.pipe(Schema.catchDecoding(() => Effect.succeedNone))
    ),
  })
);

/**
 * Reads the optional material return context from the query string of a URL.
 *
 * Invalid, repeated, or stale values remain absence so direct SEO material
 * visits keep the canonical content page without an invented curriculum parent.
 */
export function readMaterialContextQuery(search: string) {
  const query = Schema.decodeOption(MaterialContextQuery)(
    new URLSearchParams(search)
  );
  return Option.getOrUndefined(
    Option.flatMapNullishOr(query, (params) =>
      readMaterialContextHint(params[MATERIAL_CONTEXT_QUERY_PARAM])
    )
  );
}

/**
 * Serializes one validated material context identity to the canonical `ctx` key.
 *
 * Callers use this after source-identity projection succeeds; `undefined`
 * returns an empty suffix so locale switching drops invalid target contexts.
 * The tilde stays literal, as the curriculum links write it. URLSearchParams would
 * encode it, so the value is encoded as one query component instead.
 */
export function toMaterialContextQueryString(
  context: MaterialContextIdentity | undefined
) {
  if (!context) {
    return "";
  }

  return `?${MATERIAL_CONTEXT_QUERY_PARAM}=${encodeURIComponent(
    encodeMaterialContextHint(context)
  )}`;
}
