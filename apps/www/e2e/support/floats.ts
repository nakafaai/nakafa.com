/**
 * Every bare icon that floats between two lines of the words beside it. An icon no taller than 16 pixels, one step of
 * the icon scale, in a row whose words take two lines or more must stand within the first line's box: in the middle
 * of two lines it reads as belonging to neither. A mark in a tile is not read, since a tile as tall as the lines
 * stands in their middle by design, and neither is an icon set inside running words. The page serializes this
 * function, so it holds every part it reads, and it answers one sentence per icon, with the words the icon stands
 * beside.
 */
export function readFloats() {
  return Array.from(document.querySelectorAll<SVGSVGElement>("svg")).flatMap(
    (icon) => {
      const row = icon.parentElement;
      const box = icon.getBoundingClientRect();
      if (
        row === null ||
        box.height === 0 ||
        box.height > 16 ||
        !getComputedStyle(row).display.includes("flex") ||
        getComputedStyle(row).flexDirection.startsWith("column")
      ) {
        return [];
      }
      // The line boxes of the words beside the icon: each text node of the row answers one box per line it takes.
      const words = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
      const lines: DOMRect[] = [];
      for (
        let node = words.nextNode();
        node !== null;
        node = words.nextNode()
      ) {
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const line of Array.from(range.getClientRects())) {
          if (line.width > 0 && line.height > 0) {
            lines.push(line);
          }
        }
      }
      lines.sort((one, other) => one.top - other.top);
      const first = lines[0];
      const last = lines.at(-1);
      // One line of words: its last line box starts above the first one's foot.
      if (
        first === undefined ||
        last === undefined ||
        last.top < first.bottom
      ) {
        return [];
      }
      // Half a pixel either way, for a line box that ends between two pixels.
      const within =
        box.top >= first.top - 0.5 && box.bottom <= first.bottom + 0.5;
      return within
        ? []
        : [
            `an icon floats between the lines of "${(row.textContent ?? "").trim().slice(0, 40)}"`,
          ];
    }
  );
}
