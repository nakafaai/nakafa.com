import type { Page } from "@playwright/test";

/** A label that names a timer or the question the navigator shows, in each language, and any word that ends as a label. */
const OBVIOUS_LABEL =
  /^(?:time left|time remaining|timer|sisa waktu|waktu tersisa|verbleibende zeit|restzeit|(?:question|pertanyaan|soal|frage) \d+ (?:of|dari|von) \d+)\b|\p{L}:$/iu;

/**
 * The owner's rule K21 (16 Oct): a header holds at most two lines in each of its zones, and no label names what the
 * thing obviously is, such as Time left above a timer or Question 4 of 40 beside the navigator. Reads every page, panel
 * and app header as the eye does: each drawn line of text, stacked lines being those that overlap along the row, so a
 * zone is whatever stands above or below a line. Text for screen readers draws no line, so it does not count.
 */
export function readHeaderLineProblems(page: Page) {
  return page.evaluate((source) => {
    const mostLines = 2;
    const sameLine = 4;
    const obvious = new RegExp(source, "iu");

    const textNodes = (root: Element) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      while (walker.nextNode()) {
        if (
          walker.currentNode instanceof Text &&
          walker.currentNode.textContent?.trim()
        ) {
          nodes.push(walker.currentNode);
        }
      }
      return nodes;
    };

    const drawnLines = (node: Text) => {
      const parent = node.parentElement;
      // Text for screen readers stands in a clipped box, while its own rectangles keep their full width.
      if (
        parent === null ||
        parent.getBoundingClientRect().width <= 1 ||
        getComputedStyle(parent).visibility === "hidden"
      ) {
        return [];
      }
      const range = document.createRange();
      range.selectNodeContents(node);
      const text = node.textContent?.trim() ?? "";
      return Array.from(range.getClientRects())
        .filter((box) => box.width > 1 && box.height > 1)
        .map((box) => ({
          left: box.left,
          right: box.right,
          text,
          top: box.top,
        }));
    };

    const headerProblems = (header: Element) => {
      const nodes = textNodes(header);
      const lines = nodes.flatMap(drawnLines);
      const labels = nodes
        .filter((node) => drawnLines(node).length > 0)
        .map((node) => node.textContent?.trim() ?? "")
        .filter((text) => obvious.test(text))
        .map((text) => `"${text}" names what the thing obviously is`);
      const tall = lines.flatMap((line) => {
        const tops = lines
          .filter((other) => other.left < line.right && line.left < other.right)
          .map((other) => other.top)
          .sort((one, two) => one - two)
          .filter(
            (top, index, sorted) =>
              index === 0 || top - (sorted[index - 1] ?? top) > sameLine
          );
        return tops.length > mostLines
          ? [`"${line.text}" stands in ${tops.length} lines`]
          : [];
      });
      return [...labels, ...new Set(tall)];
    };

    return Array.from(
      document.querySelectorAll(
        '[data-slot="page-header"], [data-pane-header], [data-slot="app-header"]'
      )
    )
      .filter((header) => header.getBoundingClientRect().height > 0)
      .flatMap(headerProblems);
  }, OBVIOUS_LABEL.source);
}
