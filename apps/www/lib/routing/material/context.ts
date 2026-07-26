import { Option, Schema } from "effect";

/** Query parameter carrying an optional verified curriculum return context. */
export const MATERIAL_CONTEXT_QUERY_PARAM = "ctx";

const MATERIAL_CONTEXT_HINT_SEPARATOR = "~";
const MaterialContextIdentitySchema = Schema.Struct({
  nodeKey: Schema.String.pipe(Schema.minLength(1)),
  programKey: Schema.String.pipe(Schema.minLength(1)),
});

export type MaterialContextIdentity = typeof MaterialContextIdentitySchema.Type;

/** Encodes one schema-validated curriculum context into the public URL hint. */
export function encodeMaterialContextHint(context: MaterialContextIdentity) {
  return [context.programKey, context.nodeKey].join(
    MATERIAL_CONTEXT_HINT_SEPARATOR
  );
}

/** Decodes one optional URL hint without turning malformed input into failure. */
export function readMaterialContextHint(
  value: null | readonly string[] | string | undefined
) {
  if (typeof value !== "string") {
    return Option.none<MaterialContextIdentity>();
  }
  const [programKey, nodeKey, extra] = value.split(
    MATERIAL_CONTEXT_HINT_SEPARATOR
  );
  if (extra !== undefined) {
    return Option.none<MaterialContextIdentity>();
  }
  return Schema.decodeUnknownOption(MaterialContextIdentitySchema)({
    nodeKey,
    programKey,
  });
}

/** Adds a validated context hint to one canonical material URL. */
export function toContextualMaterialHref(
  href: string,
  context: MaterialContextIdentity
) {
  const separator = href.includes("?") ? "&" : "?";
  const hint = encodeURIComponent(encodeMaterialContextHint(context));
  return `${href}${separator}${MATERIAL_CONTEXT_QUERY_PARAM}=${hint}`;
}
