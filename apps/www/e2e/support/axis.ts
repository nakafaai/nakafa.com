/**
 * What one look at a row of controls finds out of line, as the owner's rule of 8 Nov 2026 reads ("Rows of controls
 * are symmetric: equal gaps, equal icon sizes, centred on one axis"): three or more siblings of a row stand equal gaps
 * apart, the icons its controls draw share one size, and the controls of a row that centers its items share one
 * middle. Nothing within a pixel counts. The page serializes this function, so it holds every part it reads.
 */
export function readRowAxis({
  margin,
  scope,
}: {
  /** The source of the class that pushes a child to the row's far end, so its gap is room left over. */
  readonly margin: string;
  readonly scope: string;
}) {
  const TOLERANCE = 1;
  const AUTO_MARGIN = new RegExp(margin, "u");
  const CONTROL =
    '[role="radio"], [role="checkbox"], [role="switch"], input[type="radio"], input[type="checkbox"], [data-slot="radio"], [data-slot="checkbox"], [data-slot="switch"]';
  const UNCOUNTED =
    'kbd, [data-slot="kbd"], [data-slot="avatar"], [role="presentation"], [aria-hidden="true"], [data-slot$="separator"]';
  const problems = new Set<string>();

  const round = (value: number) => Math.round(value * 10) / 10;
  const spread = (values: number[]) =>
    values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);
  const within = (element: Element, selector: string) =>
    element.matches(selector) ? element : element.querySelector(selector);

  const isShown = (element: Element) => {
    const box = element.getBoundingClientRect();
    return (
      box.width > 1 &&
      box.height > 1 &&
      element.checkVisibility({ visibilityProperty: true })
    );
  };

  const nameOf = (element: Element) =>
    (
      element.getAttribute("aria-label") ??
      element.textContent?.trim().slice(0, 28) ??
      ""
    ).trim() ||
    element.getAttribute("data-slot") ||
    element.tagName.toLowerCase();

  /** The children of an element as layout places them, through any that draws no box of its own. */
  const placed = (element: Element): Element[] =>
    Array.from(element.children).flatMap((child) => {
      const style = getComputedStyle(child);
      if (style.display === "contents") {
        return placed(child);
      }
      const box = child.getBoundingClientRect();
      const out =
        style.display === "none" ||
        style.position === "absolute" ||
        style.position === "fixed" ||
        box.width === 0 ||
        box.height === 0 ||
        !child.checkVisibility({ visibilityProperty: true });
      return out ? [] : [child];
    });

  /** What a child of a row is: a control, an icon or icon button, words, or neither. */
  const kindOf = (child: Element) => {
    const words = (child.textContent ?? "").trim();
    if (within(child, CONTROL) !== null) {
      return words.length > 3 ? "text" : "control";
    }
    if (words !== "") {
      return "text";
    }
    const icon = within(child, "button, a, [role='button'], svg");
    return icon !== null && icon.getBoundingClientRect().height <= 40
      ? "icon"
      : "other";
  };

  /** The box a control draws: its own control or button when it wraps one. */
  const boxOf = (child: Element) =>
    (
      within(child, CONTROL) ??
      within(child, "button, a, [role='button']") ??
      child
    ).getBoundingClientRect();

  /** Holds three or more siblings of a row of controls equal gaps apart. */
  const checkGaps = (
    row: Element,
    style: CSSStyleDeclaration,
    children: Element[],
    kinds: string[]
  ) => {
    const loose =
      style.justifyContent.includes("space") ||
      children.some((child) =>
        AUTO_MARGIN.test(child.getAttribute("class") ?? "")
      ) ||
      row.closest('[data-slot="button-group"], table') !== null ||
      kinds.filter((kind) => kind === "text").length > 1;
    if (loose || children.length < 3) {
      return;
    }
    const gaps = children.slice(1).flatMap((child, index) => {
      const before = children[index]?.getBoundingClientRect();
      const after = child.getBoundingClientRect();
      const level =
        before !== undefined &&
        after.top < before.bottom &&
        before.top < after.bottom;
      if (!level) {
        return [];
      }
      return [
        style.direction === "rtl"
          ? before.left - after.right
          : after.left - before.right,
      ];
    });
    if (gaps.length >= 2 && spread(gaps) > TOLERANCE) {
      problems.add(
        `the controls of "${nameOf(row)}" stand ${gaps.map(round).join(", ")} px apart`
      );
    }
  };

  /** Holds the icons a row's controls draw to one size. */
  const checkIcons = (row: Element, children: Element[]) => {
    const sizes = children.flatMap((child) => {
      const icon = child.matches(UNCOUNTED) ? null : within(child, "svg");
      if (icon === null || !isShown(icon) || icon.closest(UNCOUNTED) !== null) {
        return [];
      }
      const box = icon.getBoundingClientRect();
      const size = Math.max(box.width, box.height);
      return size <= 24 ? [size] : [];
    });
    if (sizes.length >= 2 && spread(sizes) > TOLERANCE) {
      problems.add(
        `the icons of "${nameOf(row)}" draw at ${Array.from(new Set(sizes.map(round))).join(" and ")} px`
      );
    }
  };

  /** Holds the controls of a row that centers its items to one middle. */
  const checkAxis = (
    row: Element,
    style: CSSStyleDeclaration,
    children: Element[],
    kinds: string[]
  ) => {
    if (style.alignItems !== "center") {
      return;
    }
    const middles = children
      .filter(
        (_, index) => kinds[index] === "control" || kinds[index] === "icon"
      )
      .map((child) => {
        const box = boxOf(child);
        return box.top + box.height / 2;
      });
    if (middles.length >= 2 && spread(middles) > TOLERANCE) {
      problems.add(
        `the controls of "${nameOf(row)}" stand off one axis by ${round(spread(middles))} px`
      );
    }
  };

  const rows = Array.from(document.querySelectorAll(scope)).flatMap((root) => [
    root,
    ...Array.from(root.querySelectorAll("*")),
  ]);
  for (const row of rows) {
    const style = getComputedStyle(row);
    const across =
      (style.display === "flex" || style.display === "inline-flex") &&
      style.flexDirection.startsWith("row") &&
      row.closest('[aria-hidden="true"]') === null &&
      isShown(row);
    const children = across ? placed(row) : [];
    if (children.length < 2) {
      continue;
    }
    const kinds = children.map(kindOf);
    checkGaps(row, style, children, kinds);
    checkIcons(row, children);
    checkAxis(row, style, children, kinds);
  }
  return Array.from(problems);
}
