const SHIKI_LINE_BOUNDARY_PATTERN = /<\/span><span class="line/g;

/**
 * Keeps Shiki line spans readable to text-only crawlers that do not apply CSS.
 */
export function preserveShikiLineBreaks(html: string) {
  return html.replace(
    SHIKI_LINE_BOUNDARY_PATTERN,
    '</span>\n<span class="line'
  );
}
