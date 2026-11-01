import type { Page } from "@playwright/test";

/**
 * The owner's rule (1 Nov): a page has one frame. Its header row sets the frame's edges, up to the app's widest
 * content, and no tab row or body reaches past them. The tab row keeps the header's gutter, so the first tab's text
 * and underline stand on the x of the header's first letter, and so does every column of the body: a rail's search,
 * its tabs and its rows, and a table's card, with the right edge mirroring it. A header holds at most two controls, a ButtonGroup
 * counting as one, and its actions never cut its path. Reads all of it from what is drawn, so a page cannot pass by
 * its class names: a text clipped by a scroller counts only as far as the scroller shows it.
 */
export function readFrameProblems(page: Page) {
  return page.evaluate(() => {
    const widest = 1280;
    const tolerance = 1;
    const desktop = 1024;
    const mostControls = 2;
    const near = 12;
    const tabs = '[data-slot="tabs-tab"]';
    const edges = `${tabs},[data-slot="input-group"],[data-slot="item"],[data-slot="card"],[data-slot="table-card"],[data-slot="pane-header"] > *`;
    const body =
      "h1,h2,h3,p,li,td,th,button,a,input,textarea,img,[data-slot=card],[data-slot=table-card],[data-slot=tabs-tab]";

    const isDrawn = (element: Element) => {
      const box = element.getBoundingClientRect();
      return (
        box.width > 1 &&
        box.height > 1 &&
        getComputedStyle(element).visibility !== "hidden"
      );
    };

    /** What of an element the eye can reach, once every scroller around it has clipped it. */
    const reachOf = (element: Element) => {
      const box = element.getBoundingClientRect();
      const reach = { left: box.left, right: box.right };
      for (
        let parent = element.parentElement;
        parent !== null;
        parent = parent.parentElement
      ) {
        if (getComputedStyle(parent).overflowX !== "visible") {
          const clip = parent.getBoundingClientRect();
          reach.left = Math.max(reach.left, clip.left);
          reach.right = Math.min(reach.right, clip.right);
        }
      }
      return reach;
    };

    /** Whether an element stands over the page or beside it, outside the page's own flow. */
    const standsApart = (element: Element) =>
      element.closest(
        '[data-slot="sidebar"],[data-slot="page-header"],[role="dialog"],[data-slot$="popup"],[data-slot="toaster"],[data-canvas]'
      ) !== null;

    const firstLetter = (root: Element) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentElement;
        if (parent !== null && node.textContent?.trim() && isDrawn(parent)) {
          const range = document.createRange();
          range.selectNodeContents(node);
          return range.getBoundingClientRect().left;
        }
      }
      return null;
    };

    const name = (element: Element) =>
      `${element.tagName.toLowerCase()} "${(element.textContent ?? "").trim().slice(0, 28)}"`;

    /** What of the page's flow reaches past the header's row. */
    const bodyProblems = (edge: DOMRect) =>
      Array.from(document.querySelectorAll(body))
        .filter((element) => isDrawn(element) && !standsApart(element))
        .map((element) => ({ element, reach: reachOf(element) }))
        .filter(
          ({ reach }) =>
            reach.right > reach.left &&
            (reach.left < edge.left - tolerance ||
              reach.right > edge.right + tolerance)
        )
        .slice(0, 3)
        .map(
          ({ element, reach }) =>
            `${name(element)} reaches ${Math.round(reach.left)} to ${Math.round(reach.right)} past the header's ${Math.round(edge.left)} to ${Math.round(edge.right)}`
        );

    /** Whether the first tab, and its underline when it is the current tab, stand on the header's first letter. */
    const tabProblems = (header: Element, start: number) => {
      const tabs = Array.from(
        document.querySelectorAll('[data-slot="tabs-list"]')
      ).find(
        (list) =>
          isDrawn(list) &&
          !standsApart(list) &&
          list.closest("aside,[data-panel]") === null
      );
      const first = tabs?.querySelector('[data-slot="tabs-tab"]') ?? null;
      if (tabs === undefined || first === null) {
        return [];
      }
      const path = header.querySelector('[data-slot="breadcrumb"]');
      const letter = path === null ? null : firstLetter(path);
      const line = innerWidth >= desktop && letter !== null ? letter : start;
      const off = (x: number) => Math.abs(x - line) > tolerance;
      const indicator = tabs.querySelector('[data-slot="tab-indicator"]');
      const left = first.getBoundingClientRect().left;
      const underline = indicator?.getBoundingClientRect().left ?? line;
      const current = first.getAttribute("aria-selected") === "true";
      return [
        indicator === null && "the tab row has no underline that slides",
        off(left) &&
          `the first tab stands at ${Math.round(left)}, the header's first letter at ${Math.round(line)}`,
        current &&
          off(underline) &&
          "the underline stands off the header's first letter",
      ].filter((problem) => typeof problem === "string");
    };

    /**
     * What should stand on the line the header's first letter draws, and on the edge that mirrors it: a search
     * bar, a tab, a list row, a card, what a pane's header holds. Their own edge counts, filled or bordered, not only their text, so a rail
     * that starts a few pixels off reads as a body wider than its header. What stands well inside, such as a
     * card in a card, is left alone, and a tab row that scrolls may run on to the screen's edge.
     */
    const edgeProblems = (header: Element, start: number, end: number) => {
      const path = header.querySelector('[data-slot="breadcrumb"]');
      const letter = path === null ? null : firstLetter(path);
      const line = innerWidth >= desktop && letter !== null ? letter : start;
      return Array.from(document.querySelectorAll(edges))
        .filter((element) => isDrawn(element) && !standsApart(element))
        .map((element) => ({ element, reach: reachOf(element) }))
        .filter(({ reach }) => reach.right > reach.left)
        .flatMap(({ element, reach }) => {
          const left = reach.left - line;
          const right = reach.right - end;
          return [
            (left < -tolerance || (left > tolerance && left < near)) &&
              `${name(element)} starts ${Math.round(left)} px off the header's first letter`,
            element.matches(tabs) === false &&
              (right > tolerance || (right < -tolerance && right > -near)) &&
              `${name(element)} ends ${Math.round(right)} px off the header's right edge`,
          ].filter((problem) => typeof problem === "string");
        })
        .slice(0, 4);
    };

    /** The header's controls, a ButtonGroup counting as one, past what a header may hold. */
    const controlProblems = (header: Element) => {
      const groups = new Set(
        Array.from(header.querySelectorAll("button,a[data-slot=button]"))
          .filter(
            (control) =>
              isDrawn(control) &&
              control.closest('[data-slot="breadcrumb"]') === null &&
              control.getAttribute("data-sidebar") !== "trigger"
          )
          .map(
            (control) =>
              control.closest('[data-slot="button-group"]') ?? control
          )
      );
      return groups.size > mostControls
        ? [`the header holds ${groups.size} controls`]
        : [];
    };

    /** The crumbs of the header's path that its row cuts. */
    const pathProblems = (header: Element) =>
      Array.from(
        header.querySelectorAll(
          '[data-slot="breadcrumb"] a,[data-slot="breadcrumb"] span'
        )
      )
        .filter(
          (crumb) =>
            crumb instanceof HTMLElement &&
            isDrawn(crumb) &&
            crumb.scrollWidth > crumb.clientWidth + tolerance
        )
        .map((crumb) => `the path is cut at ${name(crumb)}`);

    const header = Array.from(
      document.querySelectorAll('[data-slot="page-header"]')
    ).find(isDrawn);
    if (header === undefined || header.querySelector("[data-canvas]")) {
      return [];
    }
    const row = Array.from(header.children).find(
      (child) => getComputedStyle(child).maxWidth !== "none"
    );
    if (row === undefined) {
      return ["the header has no row of the page's width"];
    }
    const edge = row.getBoundingClientRect();
    const start =
      edge.left + Number.parseFloat(getComputedStyle(row).paddingLeft);
    const end =
      edge.right - Number.parseFloat(getComputedStyle(row).paddingRight);
    return [
      ...(edge.width > widest + tolerance
        ? [`the header row is ${Math.round(edge.width)} px wide`]
        : []),
      ...bodyProblems(edge),
      ...tabProblems(header, start),
      ...edgeProblems(header, start, end),
      ...controlProblems(header),
      ...pathProblems(header),
    ];
  });
}
