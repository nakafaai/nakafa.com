import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  MermaidRenderError,
  renderMermaid,
} from "@repo/design-system/lib/mermaid/render";
import { Effect } from "effect";
import type { MermaidConfig } from "mermaid";

type MermaidRenderer = typeof import("mermaid")["default"];
const initialize = vi.fn<MermaidRenderer["initialize"]>();
const render = vi.fn<MermaidRenderer["render"]>();
const defaultConfig: MermaidConfig = {};
const SVG = { svg: '<svg id="diagram"/>', diagramType: "flowchart" };

beforeEach(() => {
  vi.resetModules();
  initialize.mockReset();
  render.mockReset().mockResolvedValue(SVG);
  defaultConfig.secure = ["secure", "securityLevel", "maxTextSize", "maxEdges"];
  vi.doMock("mermaid", () => ({
    default: { initialize, render, mermaidAPI: { defaultConfig } },
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
          dompurifyConfig: undefined,
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
        defaultConfig.secure = undefined;
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
      expect(failure.operation).toBe("initialize");
      expect(failure.cause).toBeInstanceOf(Error);
      expect(initialize).not.toHaveBeenCalled();
    })
  );
});
