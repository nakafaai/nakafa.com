import { Schema } from "effect";
import { type Context, use } from "react";

/**
 * A part of a compound component rendered outside the provider whose context it
 * reads. It is a composition error in the code, never a state a learner reaches,
 * so the nearest error boundary receives it during render.
 */
export class OutsideProvider extends Schema.TaggedError<
  OutsideProvider,
  { readonly brand: unique symbol }
>()("OutsideProvider", { part: Schema.String }) {
  get message() {
    return `${this.part} renders outside the provider of its context.`;
  }
}

/**
 * Reads a context that a provider must give, for the part named `part`. A
 * context without a provider holds its default, `null` or `undefined`, and the
 * read throws `OutsideProvider`: React offers a render no other channel to an
 * error boundary.
 */
export function useRequired<T>(context: Context<T>, part: string) {
  const value = use(context);
  if (value === null || value === undefined) {
    throw new OutsideProvider({ part });
  }
  return value;
}
