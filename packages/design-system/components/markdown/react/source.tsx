import { Schema } from "effect";
import { createContext, use } from "react";

/** One fenced block of a response: its class, its code and its language. */
const FenceSourceSchema = Schema.Struct({
  className: Schema.UndefinedOr(Schema.String),
  code: Schema.String,
  language: Schema.String,
});
type FenceSource = typeof FenceSourceSchema.Type;

/**
 * Shares one fenced block's source with the parts that draw it: the placeholder
 * shown while the highlighter loads, and the highlighted block that replaces it.
 */
export const FenceSourceContext = createContext<FenceSource | null>(null);

/** Selects the source of the surrounding fenced block. */
export function useFenceSource() {
  const source = use(FenceSourceContext);
  if (source === null) {
    // A missing provider is a programmer composition error at this React seam.
    throw new Error("Fenced block parts require FenceSourceContext.");
  }
  return source;
}
