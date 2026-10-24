import { Extension } from "@tiptap/core";
import { Schema } from "effect";
import { collab } from "prosemirror-collab";

/** The version the editor starts at, and the client ID its steps carry. */
const CollabOptions = Schema.Struct({
  /** The editor's client ID. Each stored step keeps it, so the editor can tell its own steps apart. */
  clientId: Schema.String,
  /** The number of steps the server has accepted for the document the editor shows. */
  version: Schema.Natural,
});

/**
 * Installs the `collab` plugin of `prosemirror-collab` at the version it is given,
 * under this editor's client ID. The plugin keeps the steps the editor has not
 * sent yet and rebases them when other editors' steps arrive. It sends and receives
 * nothing: the sync loop in `apps/www/src/lib/editor/sync.ts` moves the steps through
 * the server (ADR 0028).
 */
export const Collab = Extension.create<typeof CollabOptions.Type>({
  name: "collab",
  addProseMirrorPlugins() {
    return [
      collab({
        clientID: this.options.clientId,
        version: this.options.version,
      }),
    ];
  },
});
