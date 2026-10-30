import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SETTLED_RENDERER, settleServerComponents } from "@/lib/static/settle";

const TREE_GETTER = Symbol.for("tanstack.rsc.getTree");
const LAZY_NODE = Symbol.for("react.lazy");

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

        yield* settleServerComponents({
          page: {
            body: serverComponent(() => [shared, shared]),
            title: "A lesson",
          },
        });

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
          serverComponent(() => ({ props: {}, type }))
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

        yield* settleServerComponents(serverComponent(() => node));

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

        yield* settleServerComponents(serverComponent(() => node));

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

        yield* settleServerComponents(serverComponent(() => node));

        expect(node._init).toHaveBeenCalledTimes(64);
      })
  );

  it.effect(
    "leaves a tree that is still decoding, and a lazy node with no reader, alone",
    () =>
      Effect.gen(function* () {
        const reader = vi.fn();

        yield* settleServerComponents([
          serverComponent(() => {
            throw new Error("A hook can only be called inside a component");
          }),
          { $$typeof: LAZY_NODE, _init: "not a reader", _payload: reader },
          "text",
          null,
        ]);

        expect(reader).not.toHaveBeenCalled();
      })
  );
});
