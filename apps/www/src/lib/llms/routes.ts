import { HttpMediaTypeSchema } from "@repo/utilities/http/accept";
import { Schema } from "effect";

/** The media type of every Markdown answer of the site, which the static twins and the llms route share. */
export const LLMS_MARKDOWN_MEDIA_TYPE = HttpMediaTypeSchema.make(
  "text/markdown; charset=utf-8"
);

/** The request fields that a Markdown answer depends on, which a shared cache keys by. */
export const LLMS_REPRESENTATION_VARY_FIELDS = Object.freeze([
  "Accept",
  "Accept-Encoding",
]);

/** The Markdown suffix of a route, and the route without it. */
const MarkdownPathname = Schema.Struct({
  markdownExtension: Schema.Literals(["", ".md", ".mdx"]),
  pathname: Schema.String,
});
type MarkdownPathname = typeof MarkdownPathname.Type;

/** Reads one supported Markdown suffix without widening its value contract. */
function readLlmsMarkdownExtension(
  pathname: string
): MarkdownPathname["markdownExtension"] {
  if (pathname.endsWith(".mdx")) {
    return ".mdx";
  }

  if (pathname.endsWith(".md")) {
    return ".md";
  }

  return "";
}

/** Removes one explicit Markdown suffix while preserving its exact spelling. */
export function readLlmsMarkdownPathname(pathname: string): MarkdownPathname {
  const markdownExtension = readLlmsMarkdownExtension(pathname);
  return {
    markdownExtension,
    pathname: markdownExtension
      ? pathname.slice(0, -markdownExtension.length)
      : pathname,
  };
}
