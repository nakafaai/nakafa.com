import { Predicate } from "effect";

/**
 * The mark of a renderer that draws words or numbers of its own on the server,
 * such as a card's readouts. The content tree gives it the artifact's locale as
 * its `locale` prop, since a server component has no context to read it from.
 */
export const TAKES_LOCALE = Symbol.for("nakafa.renderer.takesLocale");

/** Whether a component is marked to take the artifact's locale. */
export function takesLocale(type: unknown) {
  return Predicate.isFunction(type) && Reflect.get(type, TAKES_LOCALE) === true;
}
