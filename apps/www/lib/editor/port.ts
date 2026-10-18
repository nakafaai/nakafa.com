import { EditorState } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { Array as Arr, Effect } from "effect";
import { collab, getVersion } from "prosemirror-collab";
import type { EditorPort } from "@/lib/editor/session";

/** The key of the collab plugin, which every plugin that `collab()` makes carries. */
const COLLAB_KEY = collab().spec.key;

/**
 * The sync loop's port over a ProseMirror view of the document. A change applies only
 * while the view still holds the state the change was built from, so an edit that landed
 * in between is never overwritten. A fresh state takes the view's plugins, with a collab
 * plugin for the session that the server gave, so the editor records its own steps under
 * that client ID.
 */
export const viewPort = (view: EditorView): EditorPort => ({
  dispatch: (from, transaction) =>
    Effect.sync(() => {
      if (view.state !== from) {
        return false;
      }
      view.dispatch(transaction);
      return true;
    }),
  fresh: ({ clientId, doc, version }) =>
    EditorState.create({
      doc,
      plugins: [
        ...Arr.filter(
          view.state.plugins,
          (plugin) => plugin.spec.key !== COLLAB_KEY
        ),
        collab({ clientID: clientId, version }),
      ],
      schema: view.state.schema,
    }),
  replace: (from, next) =>
    Effect.sync(() => {
      if (view.state !== from) {
        return false;
      }
      view.updateState(next);
      return true;
    }),
  schema: view.state.schema,
  state: Effect.sync(() => view.state),
});

/** The version of the document a view holds: the number of steps its server accepted. */
export const versionOf = (view: EditorView) => getVersion(view.state);
