import { type EditorOptions, Extension } from "@tiptap/core";
import { Highlight } from "@tiptap/extension-highlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import type { Node } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { StarterKit } from "@tiptap/starter-kit";
import { Function as Fn, String as Str } from "effect";

/**
 * Refuses every edit that would take the Markdown of the text past `limit`
 * characters, so the text a reader sees is always text that fits. An edit that
 * makes a text shorter always passes. When a paste is refused, `onRefuse` runs,
 * because nothing else tells the reader why nothing was inserted.
 */
const Limit = Extension.create<{ limit: number; onRefuse: () => void }>({
  addOptions: () => ({ limit: 0, onRefuse: Fn.constVoid }),
  addProseMirrorPlugins() {
    const { editor, options } = this;
    const size = (doc: Node) =>
      Str.length(
        Str.trim(editor.storage.markdown.manager.serialize(doc.toJSON()))
      );

    return [
      new Plugin({
        filterTransaction: (transaction, state) => {
          if (!transaction.docChanged) {
            return true;
          }

          const grown = size(transaction.doc);

          if (grown <= options.limit || grown <= size(state.doc)) {
            return true;
          }
          // ProseMirror marks the transaction of a paste with this meta.
          if (transaction.getMeta("paste") === true) {
            options.onRefuse();
          }
          return false;
        },
      }),
    ];
  },
  name: "limit",
});

/**
 * What makes the rich editor the editor it is: its extensions, which read and
 * write the Markdown of a text, and the direction of each block, which follows
 * the words in it. The block and the title around it set no direction of their
 * own, so a learner who writes in Arabic and then in English has each line on
 * its own side. The direction is a property of the document in the browser and
 * never reaches the Markdown that is stored.
 *
 * `limit` is the most characters the Markdown may hold, `onRefuse` runs when a
 * paste does not fit, and `placeholder` is the hint of an empty text.
 */
export function richOptions({
  limit,
  onRefuse,
  placeholder,
}: {
  limit: number;
  onRefuse: () => void;
  placeholder: string;
}) {
  return {
    extensions: [
      StarterKit.configure({
        dropcursor: false,
        gapcursor: false,
        heading: { levels: [1, 2, 3] },
        link: { autolink: true, defaultProtocol: "https", openOnClick: false },
      }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown,
      Limit.configure({ limit, onRefuse }),
      Placeholder.configure({ placeholder }),
    ],
    textDirection: "auto",
  } satisfies Pick<EditorOptions, "extensions" | "textDirection">;
}
