/**
 * Loads the page again, the retry of a paginated list. A paginated read keeps no retry
 * of its own that a page can ask for, so its failure retries by loading the page again,
 * as the full-page failure does.
 */
export function reloadPage() {
  window.location.reload();
}
