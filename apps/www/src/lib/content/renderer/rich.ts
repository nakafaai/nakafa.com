import {
  type RichText,
  RichTextSchema,
} from "@nakafa/aksara-contracts/assessment/inline";
import { Array as Arr, Predicate, Record as Rec, Schema } from "effect";

/** Checks whether a prop value is rich text: the inline nodes of a document. */
const isRichText = Schema.is(RichTextSchema);

/**
 * Replaces every rich text inside a figure's props with what `render` makes of
 * it, through lists and objects. A catalog schema writes rich text as inline
 * nodes and nothing else in that shape, so the props a renderer takes are the
 * props with each rich text drawn.
 */
export function mapRichText(
  value: unknown,
  render: (text: RichText) => unknown
): unknown {
  if (isRichText(value)) {
    return render(value);
  }
  if (Arr.isArray(value)) {
    return Arr.map(value, (item) => mapRichText(item, render));
  }
  if (Predicate.isObject(value)) {
    return Rec.map(value, (item) => mapRichText(item, render));
  }
  return value;
}

/** Draws every rich text of one figure's props, the props its renderer then takes. */
export function mapRichProps(
  props: Readonly<Record<string, unknown>>,
  render: (text: RichText) => unknown
) {
  return Rec.map(props, (value) => mapRichText(value, render));
}
