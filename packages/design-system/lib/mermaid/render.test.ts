import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  MermaidRenderError,
  parseMermaid,
  renderMermaid,
} from "@repo/design-system/lib/mermaid/render";
import { Effect } from "effect";
import type { MermaidConfig } from "mermaid";

type MermaidRenderer = typeof import("mermaid")["default"];
const initialize = vi.fn<MermaidRenderer["initialize"]>();
const render = vi.fn<MermaidRenderer["render"]>();
const parse = vi.fn<MermaidRenderer["parse"]>();
let defaultConfig: MermaidConfig = {};
const SVG = { svg: '<svg id="diagram"/>', diagramType: "flowchart" };

/** Runs an effect on a runtime without `Object.groupBy`, as Safari before 17.4 is. */
const withoutGroupBy = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const native = Reflect.getOwnPropertyDescriptor(Object, "groupBy");
      Reflect.deleteProperty(Object, "groupBy");
      return native;
    }),
    () => effect,
    (native) =>
      Effect.sync(() => {
        if (native !== undefined) {
          Reflect.defineProperty(Object, "groupBy", native);
        }
      })
  );

beforeEach(() => {
  vi.resetModules();
  initialize.mockReset();
  render.mockReset().mockResolvedValue(SVG);
  parse.mockReset().mockResolvedValue({ config: {}, diagramType: "flowchart" });
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
          layout: "dagre",
          look: "classic",
          flowchart: { wrappingWidth: 200, minNodeWidth: 0 },
          state: { minNodeWidth: 0 },
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

  it.effect(
    "gives Mermaid an Object.groupBy before it loads where the browser lacks one",
    () =>
      Effect.gen(function* () {
        let grouped: unknown;
        initialize.mockImplementation(() => {
          const groupBy = Reflect.get(Object, "groupBy");
          grouped =
            typeof groupBy === "function"
              ? groupBy(["a", "bb", "cc", 7], (item: unknown, index: number) =>
                  index < 2 ? "first" : typeof item
                )
              : undefined;
        });
        yield* withoutGroupBy(renderMermaid("diagram", "graph TD; A-->B", {}));
        expect(grouped).toEqual({
          first: ["a", "bb"],
          number: [7],
          string: ["cc"],
        });
        expect(Object.getPrototypeOf(grouped)).toBeNull();
      })
  );

  it.effect("keeps a native Object.groupBy", () =>
    Effect.gen(function* () {
      const native = Reflect.get(Object, "groupBy");
      yield* renderMermaid("diagram", "graph TD; A-->B", {});
      expect(Reflect.get(Object, "groupBy")).toBe(native);
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

  it.effect("parses a chart with the settings that draw it", () =>
    Effect.gen(function* () {
      yield* parseMermaid("graph TD; A-->B");
      expect(parse).toHaveBeenCalledWith("graph TD; A-->B");
      expect(initialize).toHaveBeenCalledWith(
        expect.objectContaining({ layout: "dagre", securityLevel: "strict" })
      );
    })
  );

  it.effect("reports a chart Mermaid cannot parse as a parse failure", () =>
    Effect.gen(function* () {
      const cause = new Error("Parse error on line 2");
      parse.mockRejectedValue(cause);
      const failure = yield* Effect.flip(parseMermaid('graph TD\nA["E("C")"]'));
      expect(failure).toBeInstanceOf(MermaidRenderError);
      expect(failure.operation).toBe("parse");
      expect(failure.cause).toBe(cause);
      expect(render).not.toHaveBeenCalled();
    })
  );
});
