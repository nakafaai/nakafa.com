/**
 * What one look at a surface finds overlapping, as the owner's rule of 8 Nov 2026 reads ("nothing overlaps or
 * touches"): no control covers another, counting each control's focus ring, outline and the rings its parts draw,
 * such as a dot's ring in hand, and no control crosses the outline or ring of the framed row or card that holds it.
 * Controls a group joins on one border by design, a button group or a field with its addons, are read as one. Each
 * finding names both elements and the depth of the overlap in pixels. The page serializes this function, so it holds
 * every part it reads.
 */
export function readOverlaps({
  ring,
  scope,
}: {
  /** The source of one shadow of a computed box-shadow: whether it is inset, its colour, offsets, blur and spread. */
  readonly ring: string;
  readonly scope: string;
}) {
  const TOLERANCE = 0.5;
  const RING = new RegExp(ring, "gu");
  const CONTROL =
    "button, a[href], input:not([type='hidden']), textarea, select, [role='button'], [role='radio'], [role='checkbox'], [role='switch'], [role='slider'], [contenteditable='true']";
  const JOINED =
    '[data-slot="button-group"], [data-slot="input-group"], [data-slot="toggle-group"], [role="tablist"], [role="menubar"], table';
  const problems = new Set<string>();
  const round = (value: number) => Math.round(value * 10) / 10;

  const nameOf = (element: Element) =>
    (
      element.getAttribute("aria-label") ??
      element.textContent?.trim().slice(0, 28) ??
      ""
    ).trim() ||
    element.getAttribute("data-slot") ||
    element.tagName.toLowerCase();

  /** How far a box's rings and outline reach past its border: the widest solid spread, or the outline and its offset. */
  const reachOf = (style: CSSStyleDeclaration) => {
    const rings = Array.from(style.boxShadow.matchAll(RING)).flatMap(
      (shadow) => {
        const parts = shadow.groups ?? {};
        const solid =
          parts.before === undefined &&
          parts.after === undefined &&
          Number(parts.x) === 0 &&
          Number(parts.y) === 0 &&
          Number(parts.blur) === 0;
        return solid ? [Number(parts.spread)] : [];
      }
    );
    const outline =
      style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0
        ? Number.parseFloat(style.outlineWidth) +
          Math.max(0, Number.parseFloat(style.outlineOffset))
        : 0;
    return Math.max(0, outline, ...rings);
  };

  const grow = (box: DOMRect, by: number) =>
    new DOMRect(
      box.x - by,
      box.y - by,
      box.width + by * 2,
      box.height + by * 2
    );

  /** The boxes a control draws: its own, grown by its rings and outline, and those of its parts that draw a ring. */
  const drawnOf = (control: Element) =>
    [control, ...Array.from(control.querySelectorAll("*"))].flatMap((part) => {
      const style = getComputedStyle(part);
      const reach = reachOf(style);
      if (part !== control && reach === 0) {
        return [];
      }
      return Array.from(part.getClientRects())
        .filter((box) => box.width > 1 && box.height > 1)
        .map((box) => grow(box, reach));
    });

  const depth = (first: DOMRect, second: DOMRect) =>
    Math.min(
      first.right - second.left,
      second.right - first.left,
      first.bottom - second.top,
      second.bottom - first.top
    );

  const isShown = (element: Element) => {
    const box = element.getBoundingClientRect();
    return (
      box.width > 1 &&
      box.height > 1 &&
      element.checkVisibility({ visibilityProperty: true }) &&
      element.closest('[aria-hidden="true"]') === null
    );
  };

  const isFramed = (element: Element) => {
    const style = getComputedStyle(element);
    const bordered =
      Number.parseFloat(style.borderTopWidth) > 0 &&
      style.borderTopColor !== "rgba(0, 0, 0, 0)" &&
      style.borderTopStyle !== "none";
    return bordered || reachOf(style) > 0;
  };

  const controls = Array.from(document.querySelectorAll(scope))
    .flatMap((root) => Array.from(root.querySelectorAll(CONTROL)))
    .filter(isShown);
  const drawn = new Map(controls.map((control) => [control, drawnOf(control)]));

  /** Whether two controls are read as one: one holds the other, or a group joins them on one border. */
  const isJoined = (first: Element, second: Element) =>
    first.contains(second) ||
    second.contains(first) ||
    (first.closest(JOINED) !== null &&
      first.closest(JOINED) === second.closest(JOINED));

  /** How deep the boxes two controls draw overlap at most, or nothing past zero when they stand apart. */
  const deepest = (first: Element, second: Element) =>
    Math.max(
      0,
      ...(drawn.get(first) ?? []).flatMap((one) =>
        (drawn.get(second) ?? []).map((other) => depth(one, other))
      )
    );

  // No control covers another.
  controls.forEach((first, index) => {
    for (const second of controls.slice(index + 1)) {
      const deep = isJoined(first, second) ? 0 : deepest(first, second);
      if (deep > TOLERANCE) {
        problems.add(
          `"${nameOf(first)}" and "${nameOf(second)}" overlap by ${round(deep)} px`
        );
      }
    }
  });

  /** Whether an element clips what it holds, as a box that scrolls does, so nothing past it draws over a frame. */
  const clips = (element: Element) => {
    const style = getComputedStyle(element);
    return style.overflowX !== "visible" || style.overflowY !== "visible";
  };

  /**
   * The nearest framed row or card around a control, or none: past a box that clips the control first, or a group's
   * own frame, which joins its controls.
   */
  const frameOf = (control: Element) => {
    let frame = control.parentElement;
    while (frame !== null && !isFramed(frame)) {
      if (clips(frame)) {
        return null;
      }
      frame = frame.parentElement;
    }
    return frame === null || frame.closest(JOINED) !== null ? null : frame;
  };

  /** The box inside a frame's border, where what it holds stands. */
  const innerOf = (frame: Element) => {
    const style = getComputedStyle(frame);
    const outer = frame.getBoundingClientRect();
    const left = Number.parseFloat(style.borderLeftWidth);
    const top = Number.parseFloat(style.borderTopWidth);
    return new DOMRect(
      outer.left + left,
      outer.top + top,
      outer.width - left - Number.parseFloat(style.borderRightWidth),
      outer.height - top - Number.parseFloat(style.borderBottomWidth)
    );
  };

  // No control crosses the outline of the framed row or card that holds it.
  for (const control of controls) {
    const frame = frameOf(control);
    if (frame === null) {
      continue;
    }
    const inner = innerOf(frame);
    const outer = frame.getBoundingClientRect();
    for (const box of drawn.get(control) ?? []) {
      const past = Math.max(
        inner.left - box.left,
        box.right - inner.right,
        inner.top - box.top,
        box.bottom - inner.bottom
      );
      if (past > TOLERANCE && depth(box, outer) > 0) {
        problems.add(
          `"${nameOf(control)}" crosses the outline of "${nameOf(frame)}" by ${round(past)} px`
        );
      }
    }
  }
  return Array.from(problems);
}
