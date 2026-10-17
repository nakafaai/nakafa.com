import type { Page } from "@playwright/test";
import { Effect, Schema } from "effect";

/**
 * Records every change in the size of the elements that match `selector` and
 * are on the page when its DOM has loaded, in the page global `key`, with the
 * time of the change and the element's name. The recorder first reports an
 * element's size when it observes the element at DOMContentLoaded, and that size
 * is the baseline, so a change counts only from then on. An element that the
 * page adds after its DOM has loaded is not observed. A layout shift names what
 * moved, and this names what was resized, so a failure can say which element grew
 * or shrank. Pass it to `page.addInitScript` with the global's name and the
 * selector. `readRecordedSizeChanges` reads what it holds.
 */
export function recordSizeChanges({
  key,
  selector,
}: {
  key: string;
  selector: string;
}) {
  const changes: {
    element: string;
    height: number;
    time: number;
    width: number;
  }[] = [];
  Object.defineProperty(window, key, { value: changes });
  const sizes = new WeakMap<Element, string>();
  const name = (element: Element) => {
    const role = element.getAttribute("role");
    return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${role ? `[role=${role}]` : ""}`;
  };
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      const size = `${width}x${height}`;
      const previous = sizes.get(entry.target);
      sizes.set(entry.target, size);
      // The first report is the size the element had when it was observed, not a change.
      if (previous !== undefined && previous !== size) {
        changes.push({
          element: name(entry.target),
          height,
          time: performance.now(),
          width,
        });
      }
    }
  });
  document.addEventListener("DOMContentLoaded", () => {
    for (const element of document.querySelectorAll(selector)) {
      observer.observe(element);
    }
  });
}

/** One size change the recorder kept: the element, its new size, and when it changed. */
const RecordedSizeChange = Schema.Struct({
  element: Schema.String,
  height: Schema.Finite,
  time: Schema.Finite,
  width: Schema.Finite,
});

/**
 * Reads the size changes that `recordSizeChanges` kept under `key`. The read
 * fails when the recorder did not start on the page, so a missing record never
 * reads as a page that did not resize.
 */
export const readRecordedSizeChanges = Effect.fn(
  "NakafaE2E.readRecordedSizeChanges"
)(function* (page: Page, key: string) {
  return yield* Effect.promise(() =>
    page.evaluate((name) => Reflect.get(window, name), key)
  ).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(RecordedSizeChange)))
  );
});
