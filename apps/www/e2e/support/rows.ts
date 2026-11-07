/**
 * The rows of the page's tables that stand on more than one line. The page serializes this function, so it holds every
 * part it reads.
 */
export function readTallRows() {
  // A row of a table stands on one line at every width: no cell's words wrap, and no cell stacks one line of words
  // over another. The tops of the visible words of a cell lie within a few pixels of each other, a badge's beside a
  // name's included; a second line sits a whole line lower. Text hidden for screen readers takes no line.
  return Array.from(
    document.querySelectorAll<HTMLTableCellElement>(
      '[data-slot="table-body"] > tr > td'
    )
  )
    .filter((cell) => {
      const box = cell.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) {
        return false;
      }
      const tops: number[] = [];
      const words = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      for (let node = words.nextNode(); node; node = words.nextNode()) {
        const holder = node.parentElement;
        if (
          node.textContent?.trim() === "" ||
          holder === null ||
          holder.getBoundingClientRect().width <= 1
        ) {
          continue;
        }
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const line of Array.from(range.getClientRects())) {
          if (line.width > 0) {
            tops.push(line.top);
          }
        }
      }
      return tops.length > 1 && Math.max(...tops) - Math.min(...tops) > 10;
    })
    .map(
      (cell) =>
        `the row of "${cell.parentElement?.querySelector("td")?.textContent?.trim().slice(0, 24)}" stands on more than one line`
    );
}
