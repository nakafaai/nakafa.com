import type { MaterialContextIdentity } from "@repo/contents/route/material/reference";
import { Array as Arr } from "effect";

/** Query parameter used only for validated material return-context hints. */
export const MATERIAL_CONTEXT_QUERY_PARAM = "ctx";

const MATERIAL_CONTEXT_HINT_SEPARATOR = "~";

/**
 * Characters a hint may hold at most, the longest a public route may be
 * (`PublicPathSchema` of the content contracts). The hint is read from a URL
 * and sent to Nina, so a longer one is no hint: the page leaves it out, and the
 * server refuses it.
 */
export const MATERIAL_CONTEXT_HINT_LENGTH = 2048;

/** Encodes one curriculum-owned context identity for material card links. */
export function encodeMaterialContextHint(context: MaterialContextIdentity) {
  return Arr.join(
    [context.programKey, context.nodeKey],
    MATERIAL_CONTEXT_HINT_SEPARATOR
  );
}

/**
 * Decodes the material context hint carried in a material URL query string.
 *
 * Invalid, repeated, or too long hints are ignored so stale URLs still render
 * the canonical material asset without inventing a parent context.
 */
export function readMaterialContextHint(
  value: string | readonly string[] | null | undefined
): MaterialContextIdentity | undefined {
  if (
    typeof value !== "string" ||
    value.length > MATERIAL_CONTEXT_HINT_LENGTH
  ) {
    return;
  }

  const parts = value.split(MATERIAL_CONTEXT_HINT_SEPARATOR);

  if (parts.length !== 2) {
    return;
  }

  const [programKey, nodeKey] = parts;

  if (!(programKey && nodeKey)) {
    return;
  }

  return { nodeKey, programKey };
}
