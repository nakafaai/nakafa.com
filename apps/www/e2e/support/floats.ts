/**
 * Every bare icon that floats between two lines of the words beside it. An icon no taller than 16 pixels, one step of
 * the icon scale, in a row whose words take two lines or more must stand within the first line's box: in the middle
 * of two lines it reads as belonging to neither. A mark in a tile is not read, since a tile as tall as the lines
 * stands in their middle by design, and neither is an icon set inside running words. Nor is the mark of a control
 * that leads with a picture, such as the account button, when it stands in the picture's middle: the mark belongs
 * to the whole row, as the picture does (#2859). The page serializes this
 * function, so it holds every part it reads, and it answers one sentence per icon, with the words the icon stands
 * beside.
 */
export function readFloats() {
  /** Whether a row lays its icon out beside its words, in one flex line. */
  const besideWords = (row: HTMLElement | null, box: DOMRect) =>
    row !== null &&
    box.height > 0 &&
    box.height <= 16 &&
    getComputedStyle(row).display.includes("flex") &&
    !getComputedStyle(row).flexDirection.startsWith("column");

  /** The line boxes of the words in a row, top first: each text node answers one box per line it takes. */
  const linesOf = (row: HTMLElement) => {
    const words = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    const lines: DOMRect[] = [];
    for (let node = words.nextNode(); node !== null; node = words.nextNode()) {
      const range = document.createRange();
      range.selectNodeContents(node);
      lines.push(
        ...Array.from(range.getClientRects()).filter(
          (line) => line.width > 0 && line.height > 0
        )
      );
    }
    return lines.sort((one, other) => one.top - other.top);
  };

  /** Whether the icon stands in the middle of the picture its control leads with, as the account button's mark does. */
  const withPicture = (row: HTMLElement, box: DOMRect) => {
    const picture = row
      .closest("button, a, [role=button]")
      ?.querySelector('[data-slot="avatar"]');
    if (!picture) {
      return false;
    }
    const face = picture.getBoundingClientRect();
    return (
      Math.abs((box.top + box.bottom) / 2 - (face.top + face.bottom) / 2) <= 1
    );
  };

  return Array.from(document.querySelectorAll<SVGSVGElement>("svg")).flatMap(
    (icon) => {
      const row = icon.parentElement;
      const box = icon.getBoundingClientRect();
      if (row === null || !besideWords(row, box) || withPicture(row, box)) {
        return [];
      }
      const lines = linesOf(row);
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
