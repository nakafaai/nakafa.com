import {
  markRenderer,
  markTokenizer,
} from "@repo/design-system/components/editor/marks";
import {
  type EditorOptions,
  Extension,
  type MarkdownToken,
  type NodeViewRenderer,
} from "@tiptap/core";
import { Highlight } from "@tiptap/extension-highlight";
import { OrderedList, TaskItem, TaskList } from "@tiptap/extension-list";
import { Underline } from "@tiptap/extension-underline";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import type { Node } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { StarterKit } from "@tiptap/starter-kit";
import { Array as Arr, Function as Fn, String as Str } from "effect";

/**
 * Refuses every edit of this editor that would take the Markdown of the text past
 * `limit` characters, so the text a reader types always fits. An edit that makes a
 * text shorter always passes. A change that another editor's steps brought in
 * carries the `rebased` meta of the collab plugin, and passes: every editor applies
 * the server's steps, so a refusal here would split this editor from the others. When
 * a paste is refused, `onRefuse` runs, because nothing else tells the reader why
 * nothing was inserted.
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
          if (
            !transaction.docChanged ||
            transaction.getMeta("rebased") !== undefined
          ) {
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

/** The tokens that `marked` found inside a token: a list always holds items, and an item its words. */
function held(tokens: MarkdownToken[] | undefined) {
  return Arr.flatMap(Arr.fromNullishOr(tokens), Fn.identity);
}

/**
 * A list whose items are numbered with digits, which is how Markdown numbers
 * them. Tiptap lexes an ordered list with a tokenizer of its own that also takes
 * one or two letters, or a roman numeral, for a number. A line such as `Dr. Budi
 * sakit` or `ok. saya` then opens as a list item and loses its first word, and
 * the next save writes `1. Budi sakit` in its place (ueberdosis/tiptap issues
 * 8376 and 8395). The fix merged upstream for 8376 only stops mixed-case titles
 * such as `Dr.` and is in no release up to 3.32.0, the version this editor pins.
 * Here `marked` lexes the list, as it lexes a bullet list, and its items are parsed
 * the way a bullet list's items are, so the words of a learner stay the words of a
 * learner.
 * Tiptap offers a `list` token to the bullet list first, so this parser only
 * sees ordered lists.
 *
 * A numbered item with a check box, `1. [ ] buy milk`, is a task to `marked`.
 * A numbered list holds no task, and Tiptap's list item reads the words after a
 * check box as plain text, which loses their marks, so the check box goes and
 * the words stay.
 */
const NumberedList = OrderedList.extend({
  markdownTokenizer: {
    level: "block",
    name: "orderedList",
    // No start to look for, as in Tiptap's own tokenizer: there is nothing to lex.
    start: () => -1,
    tokenize: Fn.constUndefined,
  },
  parseMarkdown: (token, helpers) =>
    helpers.createNode(
      "orderedList",
      typeof token.start === "number" && token.start !== 1
        ? { start: token.start }
        : {},
      helpers.parseChildren(
        Arr.map(held(token.items), (item) => ({
          ...item,
          tokens: Arr.filter(
            held(item.tokens),
            (inner) => inner.type !== "checkbox"
          ),
        }))
      )
    ),
});

/**
 * What makes the rich editor the editor it is: its extensions, which read and
 * write the Markdown of a text, and the direction of each block, which follows
 * the words in it. The block and the title around it set no direction of their
 * own, so a learner who writes in Arabic and then in English has each line on
 * its own side. The direction is a property of the document in the browser and
 * never reaches the Markdown that is stored.
 *
 * The Markdown the editor reads is CommonMark with three additions: the
 * underline and the highlight, which `marks.ts` owns and the page's reader
 * lexes the same way, and the task list.
 *
 * `limit` is the most characters the Markdown may hold, `onRefuse` runs when a
 * paste does not fit, and `placeholder` is the hint of an empty text. `taskView`
 * draws each task of a task list: the editor gives the design system's view, so
 * the box is the design system's check box and the browser draws none.
 */
export function richOptions({
  limit,
  onRefuse,
  placeholder,
  taskView,
}: {
  limit: number;
  onRefuse: () => void;
  placeholder: string;
  taskView: NodeViewRenderer;
}) {
  return {
    extensions: [
      StarterKit.configure({
        dropcursor: false,
        gapcursor: false,
        heading: { levels: [1, 2, 3] },
        link: { autolink: true, defaultProtocol: "https", openOnClick: false },
        orderedList: false,
        underline: false,
      }),
      NumberedList,
      Underline.extend({
        markdownTokenizer: markTokenizer("underline"),
        renderMarkdown: markRenderer("underline"),
      }),
      Highlight.extend({
        markdownTokenizer: markTokenizer("highlight"),
        renderMarkdown: markRenderer("highlight"),
      }),
      TaskList,
      TaskItem.extend({ addNodeView: () => taskView }).configure({
        nested: true,
      }),
      Markdown,
      Limit.configure({ limit, onRefuse }),
      Placeholder.configure({ placeholder }),
    ],
    textDirection: "auto",
  } satisfies Pick<EditorOptions, "extensions" | "textDirection">;
}
