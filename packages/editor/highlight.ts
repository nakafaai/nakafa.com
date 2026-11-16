import { Mark } from "@tiptap/core";
import { Array as Arr } from "effect";

/** The tones a highlight takes, as a lesson's `Highlight` names them. */
const TONES: readonly string[] = ["success", "warning"];

/** Reads the tone of a highlight from its markup: one of the tones, or none. */
export function toneOf(element: Pick<HTMLElement, "getAttribute">) {
  const tone = element.getAttribute("data-variant");
  return tone !== null && Arr.contains(TONES, tone) ? tone : null;
}

/**
 * A marked phrase, the contract's `highlight` mark (ADR 0031): a lesson's `Highlight` in an
 * assessment document. Its one attribute is its tone, `warning`, `success`, or none, which the
 * reader draws in the warning tone. It is drawn as a `strong`, as the published page draws it.
 */
export const Highlight = Mark.create({
  name: "highlight",
  addAttributes() {
    return {
      variant: {
        default: null,
        parseHTML: toneOf,
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.variant === null
            ? {}
            : { "data-variant": attributes.variant },
      },
    };
  },
  parseHTML() {
    return [{ tag: 'strong[data-type="highlight"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["strong", { ...HTMLAttributes, "data-type": "highlight" }, 0];
  },
});
