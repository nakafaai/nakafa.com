import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  MermaidRenderError,
  MermaidSyntaxError,
  renderMermaid,
} from "@repo/design-system/lib/mermaid/render";
import { Effect } from "effect";
import type { MermaidConfig, ParseOptions, ParseResult } from "mermaid";

type MermaidRenderer = typeof import("mermaid")["default"];
const initialize = vi.fn<MermaidRenderer["initialize"]>();
const parse =
  vi.fn<
    (text: string, options: ParseOptions) => Promise<ParseResult | false>
  >();
const render = vi.fn<MermaidRenderer["render"]>();
let defaultConfig: MermaidConfig = {};
const SVG = { svg: '<svg id="diagram"/>', diagramType: "flowchart" };

beforeEach(() => {
  vi.resetModules();
  initialize.mockReset();
  parse.mockReset().mockResolvedValue({ diagramType: "flowchart", config: {} });
  render.mockReset().mockResolvedValue(SVG);
  defaultConfig.secure = ["secure", "securityLevel", "maxTextSize", "maxEdges"];
  vi.doMock("mermaid", () => ({
    default: { initialize, parse, render, mermaidAPI: { defaultConfig } },
  }));
});

afterEach(() => {
  vi.doUnmock("mermaid");
  vi.resetModules();
});

describe("strict Mermaid rendering", () => {
  it.effect(
    "preserves appearance while overriding unsafe caller settings",
    () =>
      Effect.gen(function* () {
        const unsafeConfig: MermaidConfig = {
          theme: "dark",
          fontFamily: "Nakafa",
          securityLevel: "loose",
          secure: [],
          startOnLoad: true,
          suppressErrorRendering: false,
          dompurifyConfig: { ADD_TAGS: ["script"] },
        };
        expect(
          yield* renderMermaid("diagram", "graph TD; A-->B", unsafeConfig)
        ).toEqual(SVG);
        expect(initialize).toHaveBeenCalledExactlyOnceWith({
          theme: "dark",
          fontFamily: "Nakafa",
          securityLevel: "strict",
          startOnLoad: false,
          suppressErrorRendering: true,
          secure: [
            "secure",
            "securityLevel",
            "maxTextSize",
            "maxEdges",
            "securityLevel",
            "dompurifyConfig",
          ],
        });
        expect(render).toHaveBeenCalledExactlyOnceWith(
          "diagram",
          "graph TD; A-->B"
        );
      })
  );

  it.effect(
    "protects strict security even when the library has no default secure list",
    () =>
      Effect.gen(function* () {
        defaultConfig = {};
        yield* renderMermaid("diagram", "graph TD; A-->B", {});
        expect(initialize).toHaveBeenCalledWith(
          expect.objectContaining({
            theme: "default",
            fontFamily: "inherit",
            secure: ["securityLevel", "dompurifyConfig"],
          })
        );
      })
  );

  it.effect("reports initialization failures without attempting a render", () =>
    Effect.gen(function* () {
      const cause = new Error("initialization failed");
      initialize.mockImplementation(() => {
        throw cause;
      });
      expect(
        yield* Effect.flip(renderMermaid("diagram", "graph TD", {}))
      ).toEqual(new MermaidRenderError({ cause, operation: "initialize" }));
      expect(render).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "rejects chart text that Mermaid cannot parse before rendering",
    () =>
      Effect.gen(function* () {
        parse.mockResolvedValue(false);
        expect(
          yield* Effect.flip(renderMermaid("diagram", "not a diagram", {}))
        ).toEqual(new MermaidSyntaxError());
        expect(parse).toHaveBeenCalledExactlyOnceWith("not a diagram", {
          suppressErrors: true,
        });
        expect(render).not.toHaveBeenCalled();
      })
  );

  it.effect("reports a parser failure as an unexpected failure", () =>
    Effect.gen(function* () {
      const cause = new Error("diagram module unavailable");
      parse.mockRejectedValue(cause);
      expect(
        yield* Effect.flip(renderMermaid("diagram", "graph TD", {}))
      ).toEqual(new MermaidRenderError({ cause, operation: "parse" }));
      expect(render).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "retains the renderer failure for the last-valid-SVG boundary",
    () =>
      Effect.gen(function* () {
        const cause = new Error("invalid diagram");
        render.mockRejectedValue(cause);
        expect(
          yield* Effect.flip(renderMermaid("diagram", "invalid", {}))
        ).toEqual(new MermaidRenderError({ cause, operation: "render" }));
      })
  );

  it.effect("reports a failed lazy import as initialization failure", () =>
    Effect.gen(function* () {
      vi.resetModules();
      vi.doMock("mermaid", () => {
        throw new Error("module unavailable");
      });
      const fresh = yield* Effect.promise(
        () => import("@repo/design-system/lib/mermaid/render")
      );
      const failure = yield* Effect.flip(
        fresh.renderMermaid("diagram", "graph TD", {})
      );
      expect(failure).toBeInstanceOf(fresh.MermaidRenderError);
      expect(failure).toMatchObject({
        cause: expect.any(Error),
        operation: "initialize",
      });
      expect(initialize).not.toHaveBeenCalled();
    })
  );
});
