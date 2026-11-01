import { Option } from "effect";
// The Vite config imports this module, and only package imports resolve there.
import { SCHOOL_ENTRY_ID } from "#www/src/lib/routing/shell";
import { closingDivEnd } from "#www/src/lib/static/notfound";

/** The attribute that names the sign-in in the prerendered markup. */
const ENTRY_ATTRIBUTE = `id="${SCHOOL_ENTRY_ID}"`;

const DIV_OPENING = "<div";

const BODY_CLOSING = "</body>";

/** The language of a document, on its root element. */
const DOCUMENT_LANGUAGE = /(?<=<html[^>]*\blang=")[^"]*/u;

/** The markup of the sign-in in the page that the build prerendered for one locale, or none. */
export function readSchoolEntry(page: string): Option.Option<string> {
  const attribute = page.indexOf(ENTRY_ATTRIBUTE);
  if (attribute === -1) {
    return Option.none();
  }
  const opening = page.lastIndexOf(DIV_OPENING, attribute);
  return Option.some(page.slice(opening, closingDivEnd(page, attribute, 1)));
}

/**
 * The browser shell in one locale with the sign-in at the end of its body. React
 * hydrates the shell as the build wrote it and leaves a node after its own in the
 * body alone, as it does with one that a browser extension adds, so the sign-in is
 * not part of what hydrates (ADR 0038 D2).
 */
export function composeSchoolEntry(
  shell: string,
  entry: string,
  locale: string
) {
  const closing = shell.lastIndexOf(BODY_CLOSING);
  return `${shell.slice(0, closing)}${entry}${shell.slice(closing)}`.replace(
    DOCUMENT_LANGUAGE,
    locale
  );
}
