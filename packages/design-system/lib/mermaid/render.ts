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
    operation: Schema.Literals(["initialize", "render"]),
  }
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
    const config = {
      theme: "default",
      fontFamily: "inherit",
      ...customConfig,
      securityLevel: "strict",
      startOnLoad: false,
      suppressErrorRendering: true,
      dompurifyConfig: undefined,
      secure: [
        ...(mermaid.mermaidAPI.defaultConfig.secure ?? []),
        "securityLevel",
        "dompurifyConfig",
      ],
    } satisfies MermaidConfig;
    yield* Effect.try({
      try: () => mermaid.initialize(config),
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
