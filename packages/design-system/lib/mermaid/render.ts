import { Effect, Schema } from "effect";
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
    operation: Schema.Literals(["initialize", "parse", "render"]),
  }
) {}

/** Chart text that Mermaid rejects, such as text that names no diagram type. */
export class MermaidSyntaxError extends Schema.TaggedError<MermaidSyntaxError>()(
  "MermaidSyntaxError",
  {}
) {}

/** Loads Mermaid and prevents callers or chart directives from weakening strict SVG rendering. */
const initializeMermaid = Effect.fn("designSystem.mermaid.initialize")(
  function* (customConfig: MermaidRenderConfig) {
    const mermaidModule = yield* Effect.tryPromise({
      try: () => import("mermaid"),
      catch: (cause) =>
        new MermaidRenderError({ cause, operation: "initialize" }),
    });
    const mermaid = mermaidModule.default;
    const config: MermaidConfig = {
      theme: "default",
      fontFamily: "inherit",
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

/**
 * Renders one chart with enforced strict sanitization and typed failure
 * context. It parses the chart first, so text that Mermaid rejects fails as a
 * syntax error and never reaches the renderer.
 */
export const renderMermaid = Effect.fn("designSystem.mermaid.render")(
  function* (renderId: string, chart: string, config: MermaidRenderConfig) {
    const mermaid = yield* initializeMermaid(config);
    const parsed = yield* Effect.tryPromise({
      try: () => mermaid.parse(chart, { suppressErrors: true }),
      catch: (cause) => new MermaidRenderError({ cause, operation: "parse" }),
    });
    if (!parsed) {
      return yield* new MermaidSyntaxError();
    }
    return yield* Effect.tryPromise({
      try: () => mermaid.render(renderId, chart),
      catch: (cause) => new MermaidRenderError({ cause, operation: "render" }),
    });
  }
);
