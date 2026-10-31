import { cva } from "class-variance-authority";

/*
 * The frame of the rich text. The editor and the saved words that stand in for
 * it while its code loads use these same classes, so the bar, the boxes, the
 * spacing and the faces of the text are laid out alike. Each class string lives
 * here and nowhere else.
 */

/** The column that fills the room of an editor: the rich text, its saved words, and the element that holds them. */
export const editorFrame = cva("flex min-h-0 flex-1 flex-col");

/** The bar of controls above the text: the editor's toolbar, and its place while the code loads. */
export const editorBar = cva("flex items-center gap-1.5 border-b px-2 py-1.5");

/**
 * The row of controls inside the bar, one line high. A document's bar stands across a whole page, so
 * its controls gather in the middle, over the page the writer edits.
 */
export const editorRow = cva(
  "relative flex h-8 min-w-0 flex-1 flex-wrap content-start items-center gap-x-1.5 overflow-hidden",
  {
    defaultVariants: { align: "start" },
    variants: {
      align: {
        center: "justify-center",
        start: "",
      },
    },
  }
);

/**
 * The room the text takes at least: a prompt takes a page of writing, and a short text such as an
 * option takes one line.
 */
export const editorContent = cva("", {
  variants: {
    size: {
      line: "",
      page: "min-h-32",
    },
  },
});

/** The text inside the scroll area that scrolls it, under an overlay bar that takes no room. */
export const editorScroll = cva("text-sm/relaxed");

/**
 * The placeholder of an empty editor: Tiptap marks its empty first block and gives
 * it the hint as `data-placeholder`, and these classes draw that hint in muted text.
 */
export const editorPlaceholder = cva(
  "[&_.is-editor-empty]:before:pointer-events-none [&_.is-editor-empty]:before:float-left [&_.is-editor-empty]:before:h-0 [&_.is-editor-empty]:before:text-muted-foreground [&_.is-editor-empty]:before:content-[attr(data-placeholder)]"
);

/**
 * The document of the text: the element that holds its blocks. The editor gives
 * these classes to the element Tiptap edits, and the saved words give them to
 * their own element, so each block takes the same box in both. A line takes no
 * padding and no space between its blocks: the frame around it gives the room, so
 * its first line shares a line box with the letter that names it. An exam's
 * document (`article`) takes the published article's headings, lists, quotations,
 * inline code, tables and room between blocks from `articleProse`, so only a plain
 * text, such as a memory, draws them here. An exam's page takes no padding either:
 * the card or the paper around it gives the room, so its first line starts where a
 * lesson's and a try-out question's start, in the editor's canvas, the sitting and
 * the preview alike. Only a plain page, which draws its own field, keeps room inside
 * it. A link and a highlight take the lesson's own classes on their elements
 * (`linkVariants`, `emphasisVariants`), in every text.
 */
export const editorDocument = cva(
  "wrap-break-word relative min-h-full outline-none [font-feature-settings:'liga'_0] [font-variant-ligatures:none] [white-space:break-spaces] [&_hr]:my-3 [&_pre]:whitespace-pre-wrap [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3",
  {
    compoundVariants: [
      { class: "px-4 py-3 [&>*+*]:mt-2", size: "page", text: "plain" },
    ],
    variants: {
      size: {
        line: "",
        page: "",
      },
      text: {
        article: "",
        plain:
          "[&_blockquote]:border-s-2 [&_blockquote]:ps-3 [&_blockquote]:text-muted-foreground [&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-muted-foreground [&_h1]:font-semibold [&_h1]:text-xl [&_h2]:font-semibold [&_h2]:text-lg [&_h3]:font-semibold [&_h3]:text-base [&_li>p]:m-0 [&_ol]:list-decimal [&_ol]:ps-5 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2 [&_th]:text-start [&_th]:font-semibold [&_ul:not([data-type=taskList])]:list-disc [&_ul:not([data-type=taskList])]:ps-5",
      },
    },
    defaultVariants: {
      size: "page",
      text: "plain",
    },
  }
);

/**
 * One task of a task list: its check box beside its words. The editor's task view and the saved
 * words draw a task with these classes, so the editor takes the place of the words without moving
 * a box.
 */
export const editorTask = cva("flex items-start gap-2");

/** The room of a task's check box: one line of the task's words high, so the box sits on the first line. */
export const editorTaskBox = cva("flex h-lh shrink-0 items-center");

/** The words of a task, which take the rest of the row. */
export const editorTaskWords = cva("min-w-0 flex-1");
