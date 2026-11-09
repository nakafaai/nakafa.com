import type { ContentTreeChild } from "@nakafa/aksara-contracts/tree";
import { parseMermaid } from "@repo/design-system/lib/mermaid/render";
import { Array as Arr, Effect, Option, Predicate, Schema } from "effect";

/** One Mermaid diagram of a prerendered page: the page and the chart it draws. */
const PageDiagramSchema = Schema.Struct({
  chart: Schema.String,
  page: Schema.String,
});
type PageDiagram = typeof PageDiagramSchema.Type;

/** One diagram that Mermaid cannot parse: its page and Mermaid's own words. */
const DiagramFailureSchema = Schema.Struct({
  message: Schema.String,
  page: Schema.String,
});

/**
 * Diagrams of the release that Mermaid cannot parse. The reader of each page
 * would see that the diagram could not be drawn, so the build stops instead.
 */
export class DiagramParseError extends Schema.TaggedError<
  DiagramParseError,
  { readonly brand: unique symbol }
>()("DiagramParseError", {
  failures: Schema.Array(DiagramFailureSchema),
}) {
  /** Names the page and Mermaid's message of every diagram that cannot be drawn. */
  get message() {
    return Arr.join(
      Arr.map(this.failures, ({ message, page }) => `${page}: ${message}`),
      "\n"
    );
  }
}

/**
 * Lists the chart of every `Mermaid` element under the given blocks, in the
 * order the page draws them. A chart that is not text is listed as empty text,
 * which Mermaid refuses, so it fails as the renderer would.
 */
export function readCharts(
  children: readonly ContentTreeChild[]
): readonly string[] {
  return Arr.flatMap(children, (child) => {
    if (Predicate.isString(child)) {
      return [];
    }
    const nested = readCharts(child.children);
    if (child.name !== "Mermaid") {
      return nested;
    }
    const { chart } = child.props;
    return [Predicate.isString(chart) ? chart : "", ...nested];
  });
}

/**
 * Puts a jsdom window on the global object while the diagrams are parsed.
 * Mermaid sanitizes every label with DOMPurify, which works only when a window
 * stood there while its module evaluated, and the static build runs in Node.
 */
const withWindow = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.promise(async () => {
      const { JSDOM } = await import("jsdom");
      Reflect.set(globalThis, "window", new JSDOM("").window);
    }),
    () => effect,
    () => Effect.sync(() => Reflect.deleteProperty(globalThis, "window"))
  );

/**
 * Parses every diagram of the release with the Mermaid and the settings that
 * draw it, and fails with every one it cannot parse.
 */
export const checkDiagrams = Effect.fn("www.static.diagrams")(function* (
  diagrams: readonly PageDiagram[]
) {
  const failures = yield* withWindow(
    Effect.forEach(diagrams, ({ chart, page }) =>
      parseMermaid(chart).pipe(
        Effect.as(Option.none()),
        Effect.catchTag("MermaidRenderError", (error) =>
          Effect.succeedSome({ message: String(error.cause), page })
        )
      )
    )
  );
  const failed = Arr.getSomes(failures);
  if (failed.length > 0) {
    return yield* new DiagramParseError({ failures: failed });
  }
});
