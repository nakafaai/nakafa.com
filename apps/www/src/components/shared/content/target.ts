import { useRequired } from "@repo/design-system/hooks/required";
import { Schema } from "effect";
import { createContext } from "react";

/** The content an open-in menu links to, and the source it was published from. */
const OpenTarget = Schema.Struct({
  slug: Schema.String,
  sourceUrl: Schema.UndefinedOr(Schema.NullOr(Schema.String)),
});

/**
 * The content of the open actions. OpenContent provides it above its lazy
 * open-in submenu, which links to the content.
 */
export const OpenTargetContext = createContext<typeof OpenTarget.Type | null>(
  null
);

/** Reads the content that the open-in submenu links to. */
export function useOpenTarget() {
  return useRequired(OpenTargetContext, "useOpenTarget");
}
