import type { Page } from "@playwright/test";

/**
 * The owner's page anatomy (13 Nov), read from what is drawn: a page's body starts one rhythm under its header, or
 * under the tab row that follows it, on every page of a family; a table stands only in the list's card, which fills
 * the page's height and closes on the screen, with nothing else in the body beside it; a phone gives a table's first
 * column no more than half its card; and a card footer's sentence never folds into a column of single words.
 */
export function readAnatomy(page: Page) {
  return page.evaluate(() => {
    const tolerance = 1;
    const phone = 640;
    const sentenceFloor = 160;

    const isDrawn = (element: Element) => {
      const box = element.getBoundingClientRect();
      return (
        box.width > 1 &&
        box.height > 1 &&
        getComputedStyle(element).visibility !== "hidden"
      );
    };
    const isClear = (color: string) =>
      color === "transparent" || color.endsWith(", 0)");
    /** Whether an element paints anything of its own: text, a border, a fill or an image. */
    const paints = (element: Element) => {
      const style = getComputedStyle(element);
      const text = Array.from(element.childNodes).some(
        (node) =>
          node.nodeType === Node.TEXT_NODE &&
          (node.textContent ?? "").trim() !== ""
      );
      const border =
        Number.parseFloat(style.borderTopWidth) > 0 &&
        !isClear(style.borderTopColor);
      return (
        text ||
        border ||
        !isClear(style.backgroundColor) ||
        element.matches("img,svg,canvas,input,textarea,video")
      );
    };

    const root = Array.from(
      document.querySelectorAll('[data-slot="page"]')
    ).find(isDrawn);
    const header = root?.querySelector('[data-slot="page-header"]');
    if (root === undefined || header === null || header === undefined) {
      return { gap: null, problems: ["the page has no frame with a header"] };
    }
    // The header's part of the page: the header, and a tab row that starts where it ends.
    const chrome = Array.from(root.children).filter((child) => {
      if (child === header || child.contains(header)) {
        return true;
      }
      return (
        child.querySelector('[role="tablist"]') !== null &&
        Math.abs(
          child.getBoundingClientRect().top -
            header.getBoundingClientRect().bottom
        ) <= tolerance
      );
    });
    const chromeBottom = Math.max(
      ...chrome.map((part) => part.getBoundingClientRect().bottom)
    );
    const body = Array.from(root.querySelectorAll("*")).filter(
      (element) =>
        !chrome.some((part) => part.contains(element)) &&
        isDrawn(element) &&
        paints(element)
    );
    const firstTop = Math.min(
      ...body.map((element) => element.getBoundingClientRect().top)
    );
    const gap = Number.isFinite(firstTop)
      ? Math.round(firstTop - chromeBottom)
      : null;

    const lists = Array.from(
      root.querySelectorAll('[data-slot="page-list"]')
    ).filter(isDrawn);
    const listProblems = lists.flatMap((list) => {
      const card = list.querySelector('[data-slot="table-card"]');
      if (card === null) {
        return ["a list has no card"];
      }
      const box = card.getBoundingClientRect();
      const listBottom =
        list.getBoundingClientRect().bottom -
        Number.parseFloat(getComputedStyle(list).paddingBottom);
      const neighbours = Array.from(root.children).filter(
        (child) =>
          !chrome.includes(child) &&
          child !== list &&
          !child.contains(list) &&
          isDrawn(child)
      );
      return [
        ...(Math.abs(box.bottom - listBottom) > tolerance
          ? ["the list's card stops short of the page's end"]
          : []),
        ...(box.bottom > innerHeight + tolerance
          ? [
              "the list's card runs past the screen, so the page scrolls instead of the table",
            ]
          : []),
        ...neighbours.map(
          (child) =>
            `a ${child.tagName.toLowerCase()} stands in the body beside the list`
        ),
      ];
    });

    const tableProblems = Array.from(
      document.querySelectorAll('[data-slot="table"]')
    )
      .filter(isDrawn)
      .flatMap((table) => {
        const card = table.closest('[data-slot="table-card"]');
        if (card === null) {
          return ["a table stands without its card"];
        }
        const first = table.querySelector('[data-slot="table-head"]');
        const width = card.getBoundingClientRect().width;
        return innerWidth < phone &&
          first !== null &&
          first.getBoundingClientRect().width > width / 2 + tolerance
          ? [
              `the first column takes ${Math.round(first.getBoundingClientRect().width)} of a ${Math.round(width)} px card`,
            ]
          : [];
      });

    const footerProblems = Array.from(
      document.querySelectorAll('[data-slot="card-footer"] > p')
    )
      .filter(isDrawn)
      .filter((sentence) => {
        const footer = sentence.parentElement;
        if (footer === null) {
          return false;
        }
        const style = getComputedStyle(footer);
        const room =
          footer.getBoundingClientRect().width -
          Number.parseFloat(style.paddingLeft) -
          Number.parseFloat(style.paddingRight);
        return (
          sentence.getBoundingClientRect().width + tolerance <
          Math.min(sentenceFloor, room)
        );
      })
      .map(
        (sentence) =>
          `a footer folds its sentence to ${Math.round(sentence.getBoundingClientRect().width)} px: ${(sentence.textContent ?? "").slice(0, 40)}`
      );

    return {
      gap,
      problems: [...listProblems, ...tableProblems, ...footerProblems],
    };
  });
}
