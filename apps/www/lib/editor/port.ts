import type { Node } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { Array as Arr, Effect, Ref } from "effect";
import { collab, getVersion } from "prosemirror-collab";
import { EditorClosed, type EditorPort } from "@/lib/editor/session";

/** The key of the collab plugin, which every plugin that `collab()` makes carries. */
const COLLAB_KEY = collab().spec.key;

/**
 * A fresh state of the document at one version under one client ID. It takes the plugins
 * of `from` except the collab plugin, which the session's own collab plugin replaces, so the
 * editor records its own steps under that client ID.
 */
const freshState = (
  from: EditorState,
  input: {
    readonly clientId: string;
    readonly doc: Node;
    readonly version: number;
  }
) =>
  EditorState.create({
    doc: input.doc,
    plugins: [
      ...Arr.filter(from.plugins, (plugin) => plugin.spec.key !== COLLAB_KEY),
      collab({ clientID: input.clientId, version: input.version }),
    ],
    schema: from.schema,
  });

/**
 * Runs a change of an open view. A destroyed view takes no change, so the change fails with
 * `EditorClosed` rather than reporting that it applied or that the state is stale.
 */
const whileOpen = (
  view: EditorView,
  change: () => boolean
): Effect.Effect<boolean, EditorClosed> =>
  Effect.suspend(() =>
    view.isDestroyed
      ? Effect.fail(new EditorClosed({}))
      : Effect.succeed(change())
  );

/**
 * The sync loop's port over a ProseMirror view of the document. A change applies only
 * while the view still holds the state the change was built from, so an edit that landed
 * in between is never overwritten. A change to a destroyed view fails with `EditorClosed`.
 */
export const viewPort = (view: EditorView): EditorPort => ({
  dispatch: (from, transaction) =>
    whileOpen(view, () => {
      if (view.state !== from) {
        return false;
      }
      view.dispatch(transaction);
      return true;
    }),
  fresh: (input) => freshState(view.state, input),
  replace: (from, next) =>
    whileOpen(view, () => {
      if (view.state !== from) {
        return false;
      }
      view.updateState(next);
      return true;
    }),
  schema: view.state.schema,
  state: Effect.sync(() => view.state),
});

/**
 * A port over a state that no view holds any more, such as the last state of an editor that
 * closed. A change applies to the state the port holds, as a view's change applies to the
 * state the view shows, so the loop can send the steps that the closed editor held.
 */
export const statePort = (initial: EditorState) =>
  Effect.map(
    Ref.make(initial),
    (current): EditorPort => ({
      dispatch: (from, transaction) =>
        Ref.modify(current, (state) =>
          state === from ? [true, state.apply(transaction)] : [false, state]
        ),
      fresh: (input) => freshState(initial, input),
      replace: (from, next) =>
        Ref.modify(current, (state) =>
          state === from ? [true, next] : [false, state]
        ),
      schema: initial.schema,
      state: Ref.get(current),
    })
  );

/** The version of the document a view holds: the number of steps its server accepted. */
export const versionOf = (view: EditorView) => getVersion(view.state);
