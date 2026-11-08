import { expect, type Page } from "@playwright/test";
import { readRowAxis } from "@/e2e/support/axis";
import { readOverlaps } from "@/e2e/support/overlap";

/**
 * What one look finds out of line between markers and their words, by the owner's rule of 8 Nov 2026. A marker (a
 * number, letter, radio, check box, dot, icon or icon button) stands on the first line of the words beside it: its
 * middle on that line's middle, or its baseline on that line's baseline when both are words, and a trailing control of
 * a row with a leading marker keeps that line. Rows of one list start their markers and words one distance from the
 * row's edge and stand one gap apart. Nothing within a pixel counts, a font's rounding in every engine. The page
 * serializes this function, so it holds every part it reads.
 */
function readAsymmetry({
  marker,
  scope,
}: {
  /** The source of the words of a marker: a number or a letter, with its point. */
  readonly marker: string;
  readonly scope: string;
}) {
  const TOLERANCE = 1;
  const MOST = 60;
  const MARKER_TEXT = new RegExp(marker, "u");
  const CONTROL =
    '[role="radio"], [role="checkbox"], [role="switch"], input[type="radio"], input[type="checkbox"], [data-slot="radio"], [data-slot="checkbox"], [data-slot="switch"]';
  const BUTTON = "button, a, [role='button']";
  const FIELD = "input, textarea, select, [contenteditable='true']";
  const PLACEHOLDER = ".is-editor-empty[data-placeholder]";
  /** The first line of some words: its baseline and its middle, in the page's pixels, and the words that name it. */
  interface Line {
    baseline: number;
    middle: number;
    words: string;
  }
  const problems = new Set<string>();
  const canvas = document.createElement("canvas").getContext("2d");
  const metrics = new Map<string, { ascent: number; descent: number }>();
  /** A row of the surface with a marker: what its children are, where its markers stand, and its words. */
  interface Row {
    kinds: string[];
    markers: number[];
    text: Element;
  }
  const rows = new Map<Element, Row>();

  const round = (value: number) => Math.round(value * 10) / 10;
  const spread = (values: number[]) =>
    values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);
  const listed = (values: number[]) =>
    Array.from(new Set(values.map(round))).join(" and ");
  const middleOf = (box: DOMRect) => box.top + box.height / 2;

  /** The vertical metrics of a font, as the engine lays out its inline boxes. */
  const fontOf = (style: CSSStyleDeclaration) => {
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const known = metrics.get(font);
    if (known !== undefined) {
      return known;
    }
    const size = Number.parseFloat(style.fontSize);
    let measured = { ascent: size * 0.8, descent: size * 0.2 };
    if (canvas !== null) {
      canvas.font = font;
      const sample = canvas.measureText("Hxg");
      measured = {
        ascent: sample.fontBoundingBoxAscent,
        descent: sample.fontBoundingBoxDescent,
      };
    }
    metrics.set(font, measured);
    return measured;
  };

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

  /** The visible text nodes of an element, none inside a box clipped for screen readers or hidden. */
  const textNodes = (element: Element) => {
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const holder = node.parentElement;
      if (
        node instanceof Text &&
        (node.textContent ?? "").trim() !== "" &&
        holder !== null &&
        isShown(holder)
      ) {
        nodes.push(node);
      }
    }
    return nodes;
  };

  const visibleText = (element: Element) =>
    textNodes(element)
      .map((node) => node.textContent ?? "")
      .join("")
      .trim();

  /** A text's first line from its first glyph: its baseline, and its middle in the face of the words around it. */
  const glyphLine = (node: Text, holder: Element): Line => {
    const text = node.textContent ?? "";
    const start = text.length - text.trimStart().length;
    const end = start + ((text.codePointAt(start) ?? 0) > 0xff_ff ? 2 : 1);
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    const font = fontOf(getComputedStyle(holder));
    // A formula draws in its own face, so the line's middle comes from the face of the words around it.
    const strut = fontOf(
      getComputedStyle(holder.closest(".katex")?.parentElement ?? holder)
    );
    const baseline = range.getBoundingClientRect().top + font.ascent;
    return {
      baseline,
      middle: baseline - (strut.ascent - strut.descent) / 2,
      words: text.trim().slice(0, 28),
    };
  };

  /** An empty editor's first line: its hint, which its paragraph draws in its own first line. */
  const hintLine = (empty: Element): Line => {
    const style = getComputedStyle(empty, "::before");
    const font = fontOf(style);
    const height =
      Number.parseFloat(style.lineHeight) || font.ascent + font.descent;
    const top =
      empty.getBoundingClientRect().top +
      Number.parseFloat(getComputedStyle(empty).paddingTop);
    return {
      baseline: top + (height - font.ascent - font.descent) / 2 + font.ascent,
      middle: top + height / 2,
      words: (empty.getAttribute("data-placeholder") ?? "").slice(0, 28),
    };
  };

  /** A field's line: the middle of its content box, or of its first line for a text area. */
  const fieldLine = (field: Element): Line => {
    const box = field.getBoundingClientRect();
    const style = getComputedStyle(field);
    const top = box.top + Number.parseFloat(style.paddingTop);
    const bottom = box.bottom - Number.parseFloat(style.paddingBottom);
    return {
      baseline: Number.NaN,
      middle:
        field.tagName === "TEXTAREA"
          ? top + Number.parseFloat(style.lineHeight) / 2
          : (top + bottom) / 2,
      words: nameOf(field),
    };
  };

  const within = (element: Element, selector: string) =>
    element.matches(selector) ? element : element.querySelector(selector);

  /** The first line an element draws, or none for one that draws no words. */
  const firstLine = (element: Element): Line | null => {
    const node = textNodes(element).find(
      (item) => item.parentElement?.closest(CONTROL) === null
    );
    if (node?.parentElement) {
      return glyphLine(node, node.parentElement);
    }
    const empty = within(element, PLACEHOLDER);
    if (empty !== null && isShown(empty)) {
      return hintLine(empty);
    }
    const field = within(element, FIELD);
    if (field !== null && isShown(field) && field.tagName !== "DIV") {
      return fieldLine(field);
    }
    return null;
  };

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

  const isBoxed = (element: Element) => {
    const style = getComputedStyle(element);
    return (
      style.backgroundColor !== "rgba(0, 0, 0, 0)" ||
      Number.parseFloat(style.borderTopWidth) > 0
    );
  };

  /** What a child that draws no words is: a field, an icon button, an icon, a dot, or neither. */
  const silentKind = (child: Element) => {
    if (within(child, FIELD) !== null || within(child, PLACEHOLDER) !== null) {
      return "text";
    }
    const button = within(child, BUTTON);
    if (button !== null) {
      return button.getBoundingClientRect().height <= 40 ? "icon" : "other";
    }
    const box = child.getBoundingClientRect();
    if (within(child, "svg, img") !== null) {
      return box.height <= 24 ? "icon" : "other";
    }
    return box.width <= 24 && box.height <= 24 ? "dot" : "other";
  };

  /** What a child of a row is: a marker of some kind, the row's words, or neither. */
  const kindOf = (child: Element) => {
    if (child.matches('[data-slot="separator"], [role="separator"], hr')) {
      return "separator";
    }
    if (child.matches('[data-slot="avatar"]')) {
      return "other";
    }
    const words = visibleText(child);
    if (within(child, CONTROL) !== null) {
      return words.length > 3 ? "text" : "control";
    }
    if (words === "") {
      return silentKind(child);
    }
    if (MARKER_TEXT.test(words) && child.querySelector("svg") === null) {
      return isBoxed(child) ? "badge" : "letter";
    }
    return "text";
  };

  const isMarker = (kind: string | undefined) =>
    kind !== undefined &&
    kind !== "text" &&
    kind !== "other" &&
    kind !== "separator";

  /** The box a marker draws: its control, its button or its icon when it holds one, else its own. */
  const markerBox = (child: Element) =>
    (
      within(child, CONTROL) ??
      within(child, BUTTON) ??
      child
    ).getBoundingClientRect();

  /** The icon buttons laid over a row's words, such as the control that removes a part. */
  const overlaid = (text: Element) =>
    Array.from(text.querySelectorAll("button")).filter(
      (button) =>
        getComputedStyle(button).position === "absolute" &&
        isShown(button) &&
        visibleText(button) === ""
    );

  /** Holds one marker to the line it should share. */
  const holdMarker = (child: Element, kind: string, line: Line) => {
    if (kind === "letter") {
      const own = firstLine(child);
      if (own !== null && Math.abs(own.baseline - line.baseline) > TOLERANCE) {
        problems.add(
          `"${nameOf(child)}" stands ${round(own.baseline - line.baseline)} px off the baseline of "${line.words}"`
        );
      }
      return;
    }
    const middle = middleOf(markerBox(child));
    if (Math.abs(middle - line.middle) > TOLERANCE) {
      problems.add(
        `the ${kind} "${nameOf(child)}" stands ${round(middle - line.middle)} px off the first line of "${line.words}"`
      );
    }
  };

  /** Holds every marker of a row to its words' first line, and keeps the row for its list. */
  const checkMarkers = (row: Element, children: Element[], kinds: string[]) => {
    const index = kinds.indexOf("text");
    const text = children[index];
    const line = text === undefined ? null : firstLine(text);
    if (text === undefined || line === null) {
      return;
    }
    const leading = kinds.slice(0, index).some(isMarker);
    const held = children.filter(
      (_, place) => isMarker(kinds[place]) && (place < index || leading)
    );
    for (const child of held) {
      holdMarker(child, kinds[children.indexOf(child)] ?? "", line);
    }
    if (leading) {
      for (const button of overlaid(text)) {
        holdMarker(button, "control", line);
      }
    }
    if (held.length > 0) {
      rows.set(row, {
        kinds,
        markers: held.map((child) => {
          const box = markerBox(child);
          return box.left + box.width / 2;
        }),
        text,
      });
    }
  };

  /** The placed children of a row: a flex row, or a grid whose children stand on one line as a table's row does. */
  const rowChildren = (row: Element, style: CSSStyleDeclaration) => {
    const flex =
      (style.display === "flex" || style.display === "inline-flex") &&
      style.flexDirection.startsWith("row");
    const grid = style.display === "grid" || style.display === "inline-grid";
    if (!(flex || grid) || row.closest('[aria-hidden="true"]') !== null) {
      return [];
    }
    const children = placed(row);
    const boxes = children.map((child) => child.getBoundingClientRect());
    const level =
      Math.max(...boxes.map((box) => box.top)) <
      Math.min(...boxes.map((box) => box.bottom));
    return children.length >= 2 && (flex || level) ? children : [];
  };

  /** Holds the rows of one list to one distance from their edge for their markers and words, and one gap apart. */
  const checkList = (parent: Element, members: Element[]) => {
    const shape = (row: Element) => rows.get(row)?.kinds.join(" ") ?? "";
    const alike = members.filter(
      (row) => shape(row) === shape(members[0] ?? row)
    );
    if (alike.length < 2) {
      return;
    }
    const rtl = getComputedStyle(parent).direction === "rtl";
    const fromEdge = (row: Element, left: number, right: number) => {
      const own = row.getBoundingClientRect();
      return rtl ? own.right - right : left - own.left;
    };
    const starts = alike.map((row) => {
      const box = rows.get(row)?.text.getBoundingClientRect();
      return box === undefined ? 0 : fromEdge(row, box.left, box.right);
    });
    if (spread(starts) > TOLERANCE) {
      problems.add(
        `the words of the rows of "${nameOf(parent)}" start ${listed(starts)} px from their edge`
      );
    }
    const count = rows.get(alike[0] ?? parent)?.markers.length ?? 0;
    for (let index = 0; index < count; index += 1) {
      const centers = alike.map((row) => {
        const center = rows.get(row)?.markers[index] ?? 0;
        return fromEdge(row, center, center);
      });
      if (spread(centers) > TOLERANCE) {
        problems.add(
          `marker ${index + 1} of the rows of "${nameOf(parent)}" stands ${listed(centers)} px from their edge`
        );
      }
    }
    const columns = new Map<number, DOMRect[]>();
    for (const row of alike) {
      const box = row.getBoundingClientRect();
      columns.set(Math.round(box.left), [
        ...(columns.get(Math.round(box.left)) ?? []),
        box,
      ]);
    }
    // A gap counts only between two rows with nothing of the list between them, such as a row that is not alike.
    const others = Array.from(parent.children).map((child) =>
      child.getBoundingClientRect()
    );
    const between = (above: DOMRect, below: DOMRect) =>
      others.some(
        (box) =>
          box.height > 0 &&
          box.top >= above.bottom - TOLERANCE &&
          box.bottom <= below.top + TOLERANCE &&
          box.left < above.right &&
          above.left < box.right
      );
    for (const boxes of columns.values()) {
      const sorted = [...boxes].sort((a, b) => a.top - b.top);
      const gaps = sorted.slice(1).flatMap((box, index) => {
        const above = sorted[index];
        return above === undefined || between(above, box)
          ? []
          : [box.top - above.bottom];
      });
      if (gaps.length >= 2 && spread(gaps) > TOLERANCE) {
        problems.add(
          `the rows of "${nameOf(parent)}" stand ${listed(gaps)} px apart`
        );
      }
    }
  };

  const elements = Array.from(document.querySelectorAll(scope)).flatMap(
    (root) => [root, ...Array.from(root.querySelectorAll("*"))]
  );
  for (const row of elements) {
    const style = getComputedStyle(row);
    const children = isShown(row) ? rowChildren(row, style) : [];
    if (children.length === 0) {
      continue;
    }
    const kinds = children.map(kindOf);
    checkMarkers(row, children, kinds);
  }
  const lists = new Map<Element, Element[]>();
  for (const row of rows.keys()) {
    const parent = row.parentElement;
    if (parent !== null) {
      lists.set(parent, [...(lists.get(parent) ?? []), row]);
    }
  }
  for (const [parent, members] of lists) {
    checkList(parent, members);
  }

  const found = Array.from(problems);
  return found.length > MOST
    ? [...found.slice(0, MOST), `and ${found.length - MOST} more`]
    : found;
}

/** The words of a marker: a number or a letter, one to three of them, with its point. */
const MARKER_WORDS = /^[\p{L}\p{N}]{1,3}[.):]?$/u;

/** One shadow of a computed box-shadow: whether it is inset (before or after, by engine), its colour, offsets, blur and spread. */
const SHADOW =
  /(?<before>inset\s+)?(?:rgba?\([^)]*\)|#\w+|[a-z]+)?\s*(?<x>-?[\d.]+)px\s+(?<y>-?[\d.]+)px\s+(?<blur>[\d.]+)px\s+(?<spread>-?[\d.]+)px(?<after>\s+inset)?/u;

/** The class that pushes a child to its row's far end, so its gap is room left over and not a gap. */
const AUTO_MARGIN = /(?:^|\s|:)-?m[selrx]?-auto(?:\s|$)/u;

/** Whether every animation that ends has ended, so a popup that opens is measured where it stands. */
function settled() {
  return document
    .getAnimations()
    .every(
      (animation) =>
        animation.playState !== "running" ||
        animation.effect?.getTiming().iterations === Number.POSITIVE_INFINITY
    );
}

/** How long a surface may take to settle its animations before it is measured as it stands. */
const SETTLE_MILLISECONDS = 5000;

/**
 * Soft-expects every element under `scope` to stand symmetric and apart (`readAsymmetry`, `readRowAxis`,
 * `readOverlaps`) once fonts are in and finite animations have ended. Call it in every state a surface takes, since a
 * ring or a control that shows only then can cover another.
 */
export const expectSymmetric = async (
  page: Page,
  label: string,
  scope = "body"
) => {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page
    .waitForFunction(settled, undefined, { timeout: SETTLE_MILLISECONDS })
    .catch(() => undefined);
  expect
    .soft(
      [
        ...(await page.evaluate(readAsymmetry, {
          marker: MARKER_WORDS.source,
          scope,
        })),
        ...(await page.evaluate(readRowAxis, {
          margin: AUTO_MARGIN.source,
          scope,
        })),
        ...(await page.evaluate(readOverlaps, { ring: SHADOW.source, scope })),
      ],
      `${label}: stands symmetric`
    )
    .toEqual([]);
};
