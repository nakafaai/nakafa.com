import { Array as Arr, Effect, Record as Rec, Schema } from "effect";
import type { MermaidConfig } from "mermaid";

/** Configures appearance while the renderer owns SVG security and initialization. */
export type MermaidRenderConfig = Omit<
  MermaidConfig,
  | "securityLevel"
  | "secure"
  | "dompurifyConfig"
  | "startOnLoad"
  | "suppressErrorRendering"
>;

/** Expected client failure while loading, configuring, or rendering Mermaid. */
export class MermaidRenderError extends Schema.TaggedError<MermaidRenderError>()(
  "MermaidRenderError",
  {
    cause: Schema.Unknown,
    operation: Schema.Literals(["initialize", "render"]),
  }
) {}

/**
 * `Object.groupBy` as ECMAScript 2024 defines it for the text keys Mermaid's
 * parsers group by: each item goes, in order, into the array under the key its
 * callback returns, on an object without a prototype.
 */
function groupBy<A>(
  items: Iterable<A>,
  keyOf: (item: A, index: number) => PropertyKey
): Record<string, A[]> {
  const keyed = Arr.map(Arr.fromIterable(items), (item, index) => ({
    item,
    key: String(keyOf(item, index)),
  }));
  const groups = Rec.map(
    Arr.groupBy(keyed, ({ key }) => key),
    Arr.map(({ item }) => item)
  );
  return Object.assign(Object.create(null), groups);
}

/**
 * Mermaid 12 is built for Safari 17.4 and calls `Object.groupBy` in its
 * parsers, which Safari before 17.4 lacks. Nakafa keeps the Safari 16.4 floor
 * that Vite builds for, so a browser without the method gets it here, before
 * Mermaid loads, as Mermaid's release notes advise. A native method stays.
 */
const ensureGroupBy = Effect.sync(() => {
  if (!("groupBy" in Object)) {
    Reflect.defineProperty(Object, "groupBy", {
      configurable: true,
      value: groupBy,
      writable: true,
    });
  }
});

/** Loads Mermaid and prevents callers or chart directives from weakening strict SVG rendering. */
const initializeMermaid = Effect.fn("designSystem.mermaid.initialize")(
  function* (customConfig: MermaidRenderConfig) {
    yield* ensureGroupBy;
    const mermaidModule = yield* Effect.tryPromise({
      try: () => import("mermaid"),
      catch: (cause) =>
        new MermaidRenderError({ cause, operation: "initialize" }),
    });
    const mermaid = mermaidModule.default;
    // Mermaid 12 lays diagrams out with ELK, draws its new look, and widens and
    // wraps flowchart and state labels at 120 pixels by default. Dagre, the
    // classic look, Mermaid 11's 200-pixel flowchart wrap and no minimum width
    // keep every diagram as it was drawn before.
    const config: MermaidConfig = {
      theme: "default",
      fontFamily: "inherit",
      layout: "dagre",
      look: "classic",
      flowchart: { wrappingWidth: 200, minNodeWidth: 0 },
      state: { minNodeWidth: 0 },
      ...customConfig,
      securityLevel: "strict",
      startOnLoad: false,
      suppressErrorRendering: true,
      secure: [
        ...(mermaid.mermaidAPI.defaultConfig.secure ?? []),
        "securityLevel",
        "dompurifyConfig",
      ],
    };
    const { dompurifyConfig: _dompurifyConfig, ...securedConfig } = config;
    yield* Effect.try({
      try: () => mermaid.initialize(securedConfig),
      catch: (cause) =>
        new MermaidRenderError({ cause, operation: "initialize" }),
    });
    return mermaid;
  }
);

/** Renders one chart with enforced strict sanitization and typed failure context. */
export const renderMermaid = Effect.fn("designSystem.mermaid.render")(
  function* (renderId: string, chart: string, config: MermaidRenderConfig) {
    const mermaid = yield* initializeMermaid(config);
    return yield* Effect.tryPromise({
      try: () => mermaid.render(renderId, chart),
      catch: (cause) => new MermaidRenderError({ cause, operation: "render" }),
    });
  }
);
