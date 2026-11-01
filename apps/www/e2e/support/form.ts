import type { Page } from "@playwright/test";

/**
 * The owner's rule (1 Nov): a form reads by its gaps. A label stands tight on its value, fields stand wider apart, and
 * what a dialog or a drawer holds keeps its edges and never touches. Reads the open form as it is drawn.
 */
export function readFormProblems(page: Page) {
  return page.evaluate(() => {
    const mostLabelGap = 8;
    const leastFieldGap = 24;
    const leastEdge = 16;
    const tolerance = 1;

    const gapBetween = (first: Element, second: Element) =>
      second.getBoundingClientRect().top - first.getBoundingClientRect().bottom;

    const panel = document.querySelector(
      '[data-slot="dialog-panel"],[data-slot="drawer-panel"]'
    );
    if (panel === null) {
      return ["no form is open"];
    }

    const outer = panel.getBoundingClientRect();
    const held = Array.from(panel.children);
    const edges = held.flatMap((child) => {
      const box = child.getBoundingClientRect();
      return Math.min(
        box.top - outer.top,
        box.left - outer.left,
        outer.right - box.right
      ) <
        leastEdge - tolerance
        ? ["a child of the form's body touches its edge"]
        : [];
    });
    const touching = held
      .slice(1)
      .filter(
        (child, index) =>
          gapBetween(held[index] ?? child, child) < leastEdge - tolerance
      )
      .map(() => "two children of the form's body touch");
    const labels = Array.from(
      panel.querySelectorAll('[data-slot="field"]')
    ).flatMap((field) => {
      const label = field.querySelector('[data-slot="field-label"]');
      const value = label?.nextElementSibling;
      return label &&
        value &&
        gapBetween(label, value) > mostLabelGap + tolerance
        ? [`the label "${label.textContent}" stands off its value`]
        : [];
    });
    const fields = Array.from(
      panel.querySelectorAll('[data-slot="field-group"]')
    ).flatMap((group) => {
      const items = Array.from(group.children);
      return items
        .slice(1)
        .filter(
          (item, index) =>
            gapBetween(items[index] ?? item, item) < leastFieldGap - tolerance
        )
        .map((item) => `the field "${item.textContent}" stands too close`);
    });
    return [...edges, ...touching, ...labels, ...fields];
  });
}
