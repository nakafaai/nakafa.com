/**
 * The HTML element of the document whose id is `id`, or null when there is none.
 * The id is escaped into the selector, so an id that starts with a digit or holds
 * a colon, as a heading slug or a React `useId` value can, still selects it.
 */
export function elementById(id: string) {
  const element = document.querySelector(`#${CSS.escape(id)}`);
  return element instanceof HTMLElement ? element : null;
}
