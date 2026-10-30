import { Effect, MutableList, Predicate, Result } from "effect";

/**
 * The key under which a TanStack Start server component holds the getter of
 * its decoded tree. It is a registered symbol, the one Start's own renderer
 * reads, so the app reaches the same getter.
 */
const TREE_GETTER = Symbol.for("tanstack.rsc.getTree");

/** React's mark on a lazy node: the Flight client makes one for each part of a tree it reads later. */
const LAZY_NODE = Symbol.for("react.lazy");

/** The most times one lazy node is read while the parts it waits on arrive. */
const MAX_READS = 64;

/** Whether a value is a lazy node, whose content React reads with its `_init`. */
function isLazyNode(value: object) {
  return Reflect.get(value, "$$typeof") === LAZY_NODE;
}

/**
 * Reads one lazy node the way React's render reads it, so its content is
 * parsed before the render that shows it. A node whose part waits for another
 * throws that part's thenable, which is awaited before the next read. A node
 * that fails is left for the render, which shows its failure where it belongs.
 */
const readLazyNode = Effect.fn("www.static.readLazyNode")(function* (
  node: object
) {
  const init = Reflect.get(node, "_init");
  if (!Predicate.isFunction(init)) {
    return;
  }
  for (let read = 0; read < MAX_READS; read += 1) {
    const outcome = Result.try((): unknown =>
      init(Reflect.get(node, "_payload"))
    );
    if (Result.isSuccess(outcome)) {
      return outcome.success;
    }
    const thrown = outcome.failure;
    if (!Predicate.isPromiseLike(thrown)) {
      return;
    }
    yield* Effect.promise(() =>
      Promise.resolve(thrown).then(
        () => undefined,
        () => undefined
      )
    );
  }
});

/** The tree of a server component, or none for any other value or a tree still decoding. */
function treeOf(value: object) {
  const getTree = Reflect.get(value, TREE_GETTER);
  if (!Predicate.isFunction(getTree)) {
    return Result.failVoid;
  }
  // The getter suspends while the tree decodes, which outside a render throws.
  return Result.try((): unknown => getTree());
}

/**
 * Settles every server component in a loader's result before the route that
 * shows it commits. TanStack Start awaits the parts of a decoded tree that are
 * still arriving, but not the parts that arrived and wait to be parsed: React
 * parses those during the render that mounts the tree, and that render
 * suspends the tree's own new boundary, which draws nothing. A route that
 * mounts on a client navigation would show its body empty until the parsing
 * ends, then move everything under it. Reading each lazy node here does that
 * parsing while the previous page still shows, so the new page draws whole.
 */
export const settleServerComponents = Effect.fn(
  "www.static.settleServerComponents"
)(function* (value: unknown) {
  // Parts of a tree are shared by reference, and an Effect hash set compares
  // objects by their fields, so the visited parts are kept by identity.
  const seen = new WeakSet<object>();
  const pending = MutableList.make<unknown>();
  MutableList.append(pending, value);

  for (
    let next = MutableList.take(pending);
    next !== MutableList.Empty;
    next = MutableList.take(pending)
  ) {
    if (!Predicate.isObjectOrArray(next) || seen.has(next)) {
      continue;
    }
    seen.add(next);
    const tree = treeOf(next);
    if (Result.isSuccess(tree)) {
      MutableList.append(pending, tree.success);
      continue;
    }
    if (isLazyNode(next)) {
      MutableList.append(pending, yield* readLazyNode(next));
      continue;
    }
    for (const child of Object.values(next)) {
      MutableList.append(pending, child);
    }
  }
});
