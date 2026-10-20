import { applyStoredStep } from "@repo/backend/confect/editor/apply";
import { decodeStep } from "@repo/backend/confect/editor/step";
import type { StepView } from "@repo/backend/confect/editor/view";
import { JsonTextSchema } from "@repo/utilities/json";
import type { Node, Schema as ProseSchema } from "@tiptap/pm/model";
import { Slice } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { ReplaceStep, type Step, type StepResult } from "@tiptap/pm/transform";
import { Array as Arr, Effect, Schema } from "effect";
import { receiveTransaction } from "prosemirror-collab";
import { StepRejected, SyncFailed } from "@/lib/editor/session";

/**
 * A step that changes nothing: it replaces no content, at the start of any
 * document. The collab plugin counts a step in a version, so a stored step that is
 * skipped is passed on as this one, and the version still moves by one.
 */
const SKIPPED = new ReplaceStep(0, 0, Slice.empty);

/** Reads a document from its JSON text into a ProseMirror node of the schema. */
export const readDocument = Effect.fn("editor.sync.document")(function* (
  schema: ProseSchema,
  content: string
) {
  const json = yield* Schema.decodeEffect(JsonTextSchema)(content).pipe(
    Effect.orDie
  );
  return yield* Effect.try({
    try: () => schema.nodeFromJSON(json),
    catch: () =>
      new SyncFailed({ reason: "The snapshot does not fit the schema." }),
  });
});

/**
 * Calls ProseMirror for one step and turns its answer into the step's outcome. A
 * refusal by ProseMirror, and a throw of ProseMirror, such as a position outside the
 * document, both fail with `StepRejected`, and each keeps its reason. Any other answer
 * is the step's result.
 */
const stepOutcome = Effect.fn("editor.sync.outcome")(function* (
  run: () => StepResult
) {
  const result = yield* Effect.try({
    try: run,
    catch: (cause) => new StepRejected({ reason: String(cause) }),
  });
  if (result.failed !== null) {
    return yield* new StepRejected({ reason: result.failed });
  }
  return result;
});

/**
 * The server's document after the steps, and the steps the collab plugin receives in
 * their place. Each stored step is read and applied by the rule that the server's fold
 * uses (`applyStoredStep`), so a step that every editor skips is skipped here too, and
 * the skip is logged with its reason. A skipped step stays in the list as a step that
 * changes nothing, so the version counts it. `skipped` names the skipped steps, so the
 * caller can tell when the server skipped one of its own steps.
 */
const settle = Effect.fn("editor.sync.settle")(function* (
  schema: ProseSchema,
  server: Node,
  steps: readonly (typeof StepView.Type)[]
) {
  return yield* Effect.reduce(
    steps,
    () => ({
      doc: server,
      received: Arr.empty<Step>(),
      skipped: Arr.empty<typeof StepView.Type>(),
    }),
    (settled, view) =>
      decodeStep(view.step).pipe(
        Effect.orDie,
        Effect.flatMap((json) => applyStoredStep(schema, settled.doc, json)),
        Effect.map(({ doc, step }) => ({
          doc,
          received: Arr.append(settled.received, step),
          skipped: settled.skipped,
        })),
        Effect.catchTag("StepSkipped", (skip) =>
          Effect.logWarning(
            `The stored step at version ${view.version} is skipped by every editor: ${skip.reason}`
          ).pipe(
            Effect.as({
              doc: settled.doc,
              received: Arr.append(settled.received, SKIPPED),
              skipped: Arr.append(settled.skipped, view),
            })
          )
        )
      )
  );
});

/**
 * Reads the server's steps and settles them on the server's document, which they
 * follow. The result is the server's document after them, and the steps the editor's
 * state receives, one for each step of the reply.
 */
export const settleSteps = Effect.fn("editor.sync.settleSteps")(function* (
  schema: ProseSchema,
  server: Node,
  steps: readonly (typeof StepView.Type)[]
) {
  return yield* settle(schema, server, steps);
});

/**
 * The state after the settled steps, built from the state it is given. The steps
 * whose client id is `clientIDs` confirm the editor's unconfirmed steps, and the
 * others are rebased over them. A reopened editor passes no client ids, because the
 * steps it held are the ones it replays.
 */
export const receiveOnto = (
  state: EditorState,
  received: readonly Step[],
  clientIDs: readonly string[]
): EditorState => state.apply(receiveTransaction(state, received, clientIDs));

/**
 * Adds a step to a transaction when it applies. A step that does not apply is
 * refused with its reason, and it is left out of the transaction.
 */
export const addStep = Effect.fn("editor.sync.addStep")(function* (
  transaction: Transaction,
  step: Step
) {
  yield* stepOutcome(() => transaction.maybeStep(step));
});
