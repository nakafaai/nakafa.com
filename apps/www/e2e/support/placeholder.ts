import type { CDPSession, Page } from "@playwright/test";
import { Array as Arr, Effect, Option, Schema } from "effect";

/** The names the browser gives the parts of a search field that it draws itself. */
const PLACEHOLDER = "-webkit-input-placeholder";
const CLEAR_BUTTON = "-webkit-search-cancel-button";

/** What the browser lays out for one part of a field. */
const PartSchema = Schema.Struct({
  client: Schema.Finite,
  scroll: Schema.Finite,
});

/** A field has no part of this name in the shadow tree the browser draws it from. */
class FieldPartMissing extends Schema.TaggedError<FieldPartMissing>()(
  "FieldPartMissing",
  { part: Schema.String, selector: Schema.String }
) {
  get message() {
    return `The field ${this.selector} has no part named ${this.part}.`;
  }
}

/**
 * Reads the width of one part of a field, and the width its content runs to.
 * A part that is hidden has a width of zero.
 */
const measurePart = Effect.fn("NakafaE2E.measurePart")(function* (
  session: CDPSession,
  shadow: number,
  part: string,
  selector: string
) {
  const { nodeId } = yield* Effect.promise(() =>
    session.send("DOM.querySelector", {
      nodeId: shadow,
      selector: `[pseudo="${part}"]`,
    })
  );

  // The protocol answers zero for a node it did not find.
  if (nodeId === 0) {
    return yield* new FieldPartMissing({ part, selector });
  }

  const { object } = yield* Effect.promise(() =>
    session.send("DOM.resolveNode", { nodeId })
  );
  const objectId = yield* Effect.fromOption(
    Option.fromNullishOr(object.objectId),
    () => new FieldPartMissing({ part, selector })
  );
  const { result } = yield* Effect.promise(() =>
    session.send("Runtime.callFunctionOn", {
      functionDeclaration:
        "function () { return { client: this.clientWidth, scroll: this.scrollWidth }; }",
      objectId,
      returnByValue: true,
    })
  );

  return yield* Schema.decodeUnknownEffect(PartSchema)(result.value);
});

/**
 * Reads what a search field gives its placeholder, from the shadow tree that
 * the browser draws the field from and that a script of the page cannot reach:
 * the room of the placeholder's own box, how far its text runs past that room
 * (zero when the whole text shows), and the width of the clear button, which is
 * zero while the button is hidden. The width of the field less its padding says
 * none of this, because the clear button keeps a slot of the field's room until
 * it is hidden. `selector` names one search field. The read waits for the
 * fonts first, so the text is laid out in the face the learner sees.
 */
export const readPlaceholder = Effect.fn("NakafaE2E.readPlaceholder")(
  function* (page: Page, selector: string) {
    yield* Effect.promise(() =>
      page.evaluate(() => document.fonts.ready.then(() => undefined))
    );

    return yield* Effect.acquireUseRelease(
      Effect.promise(() => page.context().newCDPSession(page)),
      (session) =>
        Effect.gen(function* () {
          yield* Effect.promise(() => session.send("DOM.enable"));
          const { root } = yield* Effect.promise(() =>
            session.send("DOM.getDocument")
          );
          const field = yield* Effect.promise(() =>
            session.send("DOM.querySelector", {
              nodeId: root.nodeId,
              selector,
            })
          );

          if (field.nodeId === 0) {
            return yield* new FieldPartMissing({ part: "field", selector });
          }

          const { node } = yield* Effect.promise(() =>
            session.send("DOM.describeNode", {
              depth: 1,
              nodeId: field.nodeId,
              pierce: true,
            })
          );
          const tree = yield* Effect.fromOption(
            Arr.head(node.shadowRoots ?? []),
            () => new FieldPartMissing({ part: "shadow tree", selector })
          );
          const { nodeIds } = yield* Effect.promise(() =>
            session.send("DOM.pushNodesByBackendIdsToFrontend", {
              backendNodeIds: [tree.backendNodeId],
            })
          );
          const shadow = yield* Effect.fromOption(
            Arr.head(nodeIds),
            () => new FieldPartMissing({ part: "shadow tree", selector })
          );
          const placeholder = yield* measurePart(
            session,
            shadow,
            PLACEHOLDER,
            selector
          );
          const clear = yield* measurePart(
            session,
            shadow,
            CLEAR_BUTTON,
            selector
          );

          return {
            clear: clear.client,
            overflow: Math.max(0, placeholder.scroll - placeholder.client),
            room: placeholder.client,
          };
        }),
      (session) => Effect.promise(() => session.detach())
    );
  }
);
