import {
  encodeMaterialContextHint,
  MATERIAL_CONTEXT_QUERY_PARAM,
  readMaterialContextHint,
} from "@repo/contents/_types/route/material/context";
import type { MaterialContextIdentity } from "@repo/contents/_types/route/material/reference";
import {
  createLoader,
  createParser,
  createSerializer,
  type LoaderInput,
} from "nuqs/server";

/**
 * Parses the public `ctx` query value through the contents-owned context grammar.
 *
 * nuqs treats `null` as absence, which matches the product rule that malformed
 * or mismatched material context must be ignored rather than block the page.
 */
function parseMaterialContextQuery(value: string) {
  return readMaterialContextHint(value) ?? null;
}

/**
 * Serializes a validated material context identity with the source-owned codec.
 *
 * Callers only receive this identity after the material/context index proves it
 * belongs to the current source asset and target locale.
 */
function serializeMaterialContextQuery(context: MaterialContextIdentity) {
  return encodeMaterialContextHint(context);
}

const materialContextParser = createParser({
  parse: parseMaterialContextQuery,
  serialize: serializeMaterialContextQuery,
});

const materialContextSearchParams = {
  context: materialContextParser,
};

const materialContextUrlKeys = {
  context: MATERIAL_CONTEXT_QUERY_PARAM,
};

const loadMaterialContextSearchParams = createLoader(
  materialContextSearchParams,
  { urlKeys: materialContextUrlKeys }
);

const serializeMaterialContextSearchParams = createSerializer(
  materialContextSearchParams,
  { urlKeys: materialContextUrlKeys }
);

/**
 * Reads the optional material return context from supported nuqs server inputs.
 *
 * Invalid, repeated, or stale values remain absence so direct SEO material
 * visits keep the canonical content page without an invented curriculum parent.
 */
export function readMaterialContextQuery(input: LoaderInput) {
  return loadMaterialContextSearchParams(input).context ?? undefined;
}

/**
 * Serializes one validated material context identity to the canonical `ctx` key.
 *
 * Callers use this after source-identity projection succeeds; `undefined`
 * returns an empty suffix so locale switching drops invalid target contexts.
 */
export function toMaterialContextQueryString(
  context: MaterialContextIdentity | undefined
) {
  if (!context) {
    return "";
  }

  return serializeMaterialContextSearchParams({ context });
}
