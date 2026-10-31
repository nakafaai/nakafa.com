import type { Page } from "@playwright/test";

/**
 * The owner's rule (31 Oct): in a group means really joined, in one frame, or else a clear gap. Reads every header
 * and returns what breaks it. In a group the first control rounds its start, the last rounds its end, those between
 * stand square, and neighbours touch on one border. A wrapper in a group is read through the control it shows. A
 * control outside a group keeps a clear gap from its neighbour on the same row, and the path's own links do not count.
 */
export function readControlProblems(page: Page) {
  return page.evaluate(() => {
    // The least room, in pixels, between two controls that stand apart.
    const controlGap = 8;
    const seen = (node: Element) => {
      const box = node.getBoundingClientRect();
      return (
        box.width > 1 &&
        box.height > 1 &&
        getComputedStyle(node).visibility !== "hidden"
      );
    };
    const named = (node: Element) =>
      [
        node.getAttribute("aria-label"),
        node.textContent?.trim().slice(0, 24),
        node.getAttribute("data-slot"),
      ].find((name) => name !== null && name !== "") ?? node.tagName;
    const face = (part: Element) =>
      part.hasAttribute("data-slot")
        ? part
        : (Array.from(part.children).find(seen) ?? part);
    const rounded = (first: string, second: string) =>
      Number.parseFloat(first) > 1 && Number.parseFloat(second) > 1;

    const groupProblems = (group: Element) => {
      const faces = Array.from(group.children).filter(seen).map(face);
      const shapes = faces.flatMap((node, index) => {
        const style = getComputedStyle(node);
        const start = rounded(
          style.borderTopLeftRadius,
          style.borderBottomLeftRadius
        );
        const end = rounded(
          style.borderTopRightRadius,
          style.borderBottomRightRadius
        );
        const wantsStart = index === 0;
        const wantsEnd = index === faces.length - 1;
        return start === wantsStart && end === wantsEnd
          ? []
          : [
              `${named(node)}: start ${start ? "round" : "square"}, end ${end ? "round" : "square"}, part ${index + 1} of ${faces.length}`,
            ];
      });
      const joints = faces.slice(1).flatMap((node, index) => {
        const before = faces[index];
        if (before === undefined) {
          return [];
        }
        const gap =
          node.getBoundingClientRect().left -
          before.getBoundingClientRect().right;
        const doubled =
          gap >= 0 &&
          Number.parseFloat(getComputedStyle(before).borderRightWidth) > 0 &&
          Number.parseFloat(getComputedStyle(node).borderLeftWidth) > 0;
        return gap > 0.5 || gap < -1.5 || doubled
          ? [
              `${named(before)} and ${named(node)}: gap ${gap}, doubled ${doubled}`,
            ]
          : [];
      });
      return [...shapes, ...joints];
    };

    const headerProblems = (header: Element) => {
      const groups = Array.from(
        header.querySelectorAll('[data-slot="button-group"]')
      )
        .filter(seen)
        .filter(
          (group) =>
            group.querySelector(':scope > [data-slot="button-group"]') === null
        );
      const lone = Array.from(
        header.querySelectorAll(
          'button, a[data-slot="button"], [data-slot="input-group"], [data-slot="select-trigger"]'
        )
      )
        .filter(seen)
        .filter(
          (node) =>
            node.closest('nav, [data-slot="button-group"]') === null &&
            node.parentElement?.closest('button, [data-slot="input-group"]') ===
              null
        );
      const row = [...groups, ...lone].sort(
        (one, other) =>
          one.getBoundingClientRect().left - other.getBoundingClientRect().left
      );
      const gaps = row.slice(1).flatMap((node, index) => {
        const before = row[index];
        if (before === undefined) {
          return [];
        }
        const left = before.getBoundingClientRect();
        const right = node.getBoundingClientRect();
        const sameRow = right.top < left.bottom && left.top < right.bottom;
        const gap = right.left - left.right;
        return sameRow && gap < controlGap - 0.5
          ? [`${named(before)} and ${named(node)} stand ${gap} px apart`]
          : [];
      });
      return [...groups.flatMap(groupProblems), ...gaps];
    };

    return Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-slot="page-header"], [data-slot="pane-header"], [data-slot="app-header"]'
      )
    )
      .filter(seen)
      .flatMap(headerProblems);
  });
}
