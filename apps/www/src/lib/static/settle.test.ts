import { describe, expect, it } from "@effect/vitest";
import { MathFontPreload } from "@repo/design-system/components/markdown/fonts";
import { Array as Arr, Effect, Fiber, Order } from "effect";
import { TestClock } from "effect/testing";
import { SETTLED_RENDERER, settleServerComponents } from "@/lib/static/settle";

const TREE_GETTER = Symbol.for("tanstack.rsc.getTree");
const LAZY_NODE = Symbol.for("react.lazy");
const ELEMENT = Symbol.for("react.transitional.element");

/** A browser font set whose every face loads at once. */
function fontSet() {
  return { load: vi.fn((_font: string) => Promise.resolve<FontFace[]>([])) };
}

/** An element as the Flight client decodes it. */
function element(type: unknown, props: Record<string, unknown>) {
  return { $$typeof: ELEMENT, key: null, props, type };
}

/** A lazy node as the Flight client makes it: React reads its content with `_init`. */
function lazyNode(init: (payload: unknown) => unknown) {
  return { $$typeof: LAZY_NODE, _init: vi.fn(init), _payload: "payload" };
}

/** A server component as a loader returns it: its decoded tree sits behind the registered getter. */
function serverComponent(getTree: () => unknown) {
  return { [TREE_GETTER]: getTree };
}

describe("lib/static/settle", () => {
  it.effect(
    "reads every lazy node of a server component's tree, the ones its content holds included",
    () =>
      Effect.gen(function* () {
        const inner = lazyNode(() => "words");
        const outer = lazyNode(() => ({ props: { children: [inner] } }));
        const shared = { props: { children: outer } };

        yield* settleServerComponents(
          {
            page: {
              body: serverComponent(() => [shared, shared]),
              title: "A lesson",
            },
          },
          fontSet()
        );

        expect(outer._init).toHaveBeenCalledOnce();
        expect(outer._init).toHaveBeenCalledWith("payload");
        expect(inner._init).toHaveBeenCalledOnce();
      })
  );

  it.effect(
    "loads the lazy renderer a component of the tree carries, the component reached through a lazy type included",
    () =>
      Effect.gen(function* () {
        const renderer = lazyNode(() => "card");
        const component = Object.assign(() => null, {
          [SETTLED_RENDERER]: renderer,
        });
        const type = lazyNode(() => component);

        yield* settleServerComponents(
          serverComponent(() => ({ props: {}, type })),
          fontSet()
        );

        expect(type._init).toHaveBeenCalledOnce();
        expect(renderer._init).toHaveBeenCalledOnce();
      })
  );

  it.effect(
    "waits for a part that is still arriving, then reads the node again",
    () =>
      Effect.gen(function* () {
        let arrived = false;
        const part = Promise.resolve().then(() => {
          arrived = true;
        });
        const node = lazyNode(() => {
          if (!arrived) {
            throw part;
          }
          return "arrived";
        });

        yield* settleServerComponents(
          serverComponent(() => node),
          fontSet()
        );

        expect(node._init).toHaveBeenCalledTimes(2);
        expect(arrived).toBe(true);
      })
  );

  it.effect(
    "waits for a part that fails, and leaves the node for the render to show",
    () =>
      Effect.gen(function* () {
        let reads = 0;
        const node = lazyNode(() => {
          reads += 1;
          throw reads === 1
            ? Promise.reject(new Error("The part failed"))
            : new Error("The node failed");
        });

        yield* settleServerComponents(
          serverComponent(() => node),
          fontSet()
        );

        expect(node._init).toHaveBeenCalledTimes(2);
      })
  );

  it.effect(
    "stops reading a node whose parts never arrive after its last read",
    () =>
      Effect.gen(function* () {
        const node = lazyNode(() => {
          throw Promise.resolve();
        });

        yield* settleServerComponents(
          serverComponent(() => node),
          fontSet()
        );

        expect(node._init).toHaveBeenCalledTimes(64);
      })
  );

  it.effect(
    "leaves a tree that is still decoding, and a lazy node with no reader, alone",
    () =>
      Effect.gen(function* () {
        const reader = vi.fn();

        yield* settleServerComponents(
          [
            serverComponent(() => {
              throw new Error("A hook can only be called inside a component");
            }),
            { $$typeof: LAZY_NODE, _init: "not a reader", _payload: reader },
            "text",
            null,
          ],
          fontSet()
        );

        expect(reader).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "loads the math faces that the tree's formulas declare, once each, before it resolves",
    () =>
      Effect.gen(function* () {
        const fonts = fontSet();
        const lazyFormula = element(
          lazyNode(() => MathFontPreload),
          { fonts: ["Main-Regular", "Size1-Regular", "Script-Regular"] }
        );
        const span = element("span", {
          children: [lazyFormula],
          fonts: ["AMS-Regular"],
        });

        yield* settleServerComponents(
          serverComponent(() => [
            element(MathFontPreload, {
              fonts: ["Main-Regular", "Math-Italic"],
            }),
            element(MathFontPreload, {}),
            element(MathFontPreload, { fonts: "Main-Bold" }),
            element(
              { $$typeof: Symbol.for("react.memo"), type: () => null },
              {}
            ),
            span,
          ]),
          fonts
        );

        expect(
          Arr.sort(
            Arr.map(fonts.load.mock.calls, ([font]) => font),
            Order.String
          )
        ).toEqual([
          "1em KaTeX_Main",
          "1em KaTeX_Size1",
          "italic 1em KaTeX_Math",
        ]);
      })
  );

  it.effect("resolves when a math face fails to load", () =>
    Effect.gen(function* () {
      const fonts = {
        load: vi.fn((_font: string) =>
          Promise.reject<FontFace[]>(new Error("The face failed"))
        ),
      };

      yield* settleServerComponents(
        element(MathFontPreload, { fonts: ["Main-Regular"] }),
        fonts
      );

      expect(fonts.load).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "waits three seconds at most for a math face that keeps loading",
    () =>
      Effect.gen(function* () {
        let settled = false;
        const fonts = {
          load: vi.fn(
            (_font: string) => new Promise<FontFace[]>(() => undefined)
          ),
        };

        const settling = yield* Effect.forkChild(
          settleServerComponents(
            element(MathFontPreload, { fonts: ["Main-Regular"] }),
            fonts
          ).pipe(
            Effect.tap(() =>
              Effect.sync(() => {
                settled = true;
              })
            )
          )
        );
        yield* TestClock.adjust("2999 millis");
        expect(settled).toBe(false);
        yield* TestClock.adjust("1 milli");
        yield* Fiber.join(settling);
        expect(settled).toBe(true);
      })
  );
});
