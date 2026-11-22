import { HttpMediaTypeSchema } from "@repo/utilities/http/accept";
import { Array as Arr, Option, Schema } from "effect";

/** The media type of every Markdown answer of the site, which the static twins and the llms route share. */
export const LLMS_MARKDOWN_MEDIA_TYPE = HttpMediaTypeSchema.make(
  "text/markdown; charset=utf-8"
);

/**
 * The request fields that a Markdown answer depends on, which a shared cache keys
 * by. A Markdown route answers Markdown whatever the request accepts, so only the
 * encoding varies.
 */
export const LLMS_REPRESENTATION_VARY_FIELDS = Object.freeze([
  "Accept-Encoding",
]);

/**
 * The Markdown twin a route names, and the route without its suffix. The site
 * writes one twin per page, at `.md`; an `.mdx` address, the raw source the
 * earlier site served, names the same twin, so a successor always ends in `.md`.
 */
const MarkdownPathname = Schema.Struct({
  markdownExtension: Schema.Literals(["", ".md"]),
  pathname: Schema.String,
});
type MarkdownPathname = typeof MarkdownPathname.Type;

/** The Markdown suffixes an address may end in, the longer first. */
const MARKDOWN_SUFFIXES = [".mdx", ".md"] as const;

/** Removes one Markdown suffix and names the `.md` twin it stands for. */
export function readLlmsMarkdownPathname(pathname: string): MarkdownPathname {
  const suffix = Arr.findFirst(MARKDOWN_SUFFIXES, (candidate) =>
    pathname.endsWith(candidate)
  );
  return Option.match(suffix, {
    onNone: () => ({ markdownExtension: "", pathname }),
    onSome: (found) => ({
      markdownExtension: ".md",
      pathname: pathname.slice(0, -found.length),
    }),
  });
}
