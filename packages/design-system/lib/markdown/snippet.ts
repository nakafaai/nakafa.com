/** The opening tag of the MathML copy that KaTeX writes into every formula it draws. */
const MATHML_COPY = '<span class="katex-mathml">';

/** The same opening tag, closed to search snippets. */
const MATHML_COPY_WITHOUT_SNIPPET =
  '<span class="katex-mathml" data-nosnippet="">';

/**
 * Keeps a formula's MathML copy out of search snippets and AI answers. KaTeX draws
 * every formula twice: the MathML copy a screen reader reads and the page hides, and
 * the copy a reader sees, which screen readers skip. Google quotes both, so a result
 * read "mean μ μ and standard deviation σ σ>0". `data-nosnippet` leaves the copy the
 * reader sees, and screen readers still read the MathML, since the attribute only
 * speaks to search engines.
 *
 * @see https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag#data-nosnippet-attr
 */
export function closeMathCopyToSnippets(html: string) {
  return html.replaceAll(MATHML_COPY, MATHML_COPY_WITHOUT_SNIPPET);
}
