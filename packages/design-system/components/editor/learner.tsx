import {
  FunctionIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  SourceCodeIcon,
  TextBoldIcon,
  TextItalicIcon,
} from "@hugeicons/core-free-icons";
import { useCallbackRef } from "@mantine/hooks";
import { placeCaret } from "@repo/design-system/components/editor/caret";
import {
  Limit,
  NumberedList,
} from "@repo/design-system/components/editor/extensions";
import {
  FORMULA_VIEWS,
  FormulaLabelsProvider,
} from "@repo/design-system/components/editor/formula";
import { editorPlaceholder } from "@repo/design-system/components/editor/frame";
import { RichEditorLink } from "@repo/design-system/components/editor/link";
import { markdownFormulas } from "@repo/design-system/components/editor/tex";
import { EditorTools } from "@repo/design-system/components/editor/tools";
import {
  InputGroup,
  InputGroupAddon,
} from "@repo/design-system/components/ui/input-group";
import { useRequired } from "@repo/design-system/hooks/required";
import {
  learnerTextVariants,
  linkVariants,
} from "@repo/design-system/lib/prose";
import type { EditorOptions } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import type { EditorProps } from "@tiptap/pm/view";
import {
  EditorContent,
  EditorContext,
  useCurrentEditor,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { Array as Arr } from "effect";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useMemo,
  useState,
} from "react";

/** The frame of the editor: the text over its bar, in the field a learner writes in. */
const learnerFrame = cva("dark:bg-input/30 rounded-xl bg-transparent");

/** The text of the editor: a line at least, then growing to a few lines before it scrolls. */
const learnerText = cva("max-h-64 min-h-10 w-full overflow-y-auto px-3 pt-2.5");

/**
 * What makes the learner editor, which writes a comment, the editor it is: bold, italic and code words,
 * links, bulleted and numbered lists, and formulas, read from and written to the Markdown the page draws
 * as learner text. It offers no heading, quote, code block, divider or task, which a comment does not
 * need. `limit` is the most characters the Markdown may hold, `onRefuse` runs when a paste does not fit,
 * and `placeholder` is the hint of an empty text.
 */
function learnerOptions({
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
        blockquote: false,
        codeBlock: false,
        dropcursor: false,
        gapcursor: false,
        heading: false,
        horizontalRule: false,
        link: {
          autolink: true,
          defaultProtocol: "https",
          HTMLAttributes: { class: linkVariants() },
          openOnClick: false,
        },
        orderedList: false,
        strike: false,
        underline: false,
      }),
      NumberedList,
      ...markdownFormulas(FORMULA_VIEWS),
      Markdown,
      Limit.configure({ limit, onRefuse }),
      Placeholder.configure({ placeholder }),
    ],
    textDirection: "auto",
  } satisfies Pick<EditorOptions, "extensions" | "textDirection">;
}

/** The names of the editor's controls and of its formula editor. */
interface LearnerLabels {
  readonly bold: string;
  readonly bullets: string;
  readonly code: string;
  readonly formula: string;
  readonly formulaEdit: ComponentProps<typeof FormulaLabelsProvider>["labels"];
  readonly italic: string;
  readonly link: string;
  readonly linkInvalid: string;
  readonly linkPlaceholder: string;
  readonly numbers: string;
}

/** The names of the controls, which the editor provides to its bar. */
const LearnerLabelsContext = createContext<LearnerLabels | null>(null);

/** Reads the names of the controls from the surrounding editor. */
function useLearnerLabels() {
  return useRequired(LearnerLabelsContext, "useLearnerLabels");
}

/** The formats of a learner's text, each its own control: bold, italic, code, two lists, a link and a formula. */
function LearnerTools() {
  const labels = useLearnerLabels();
  const { editor } = useCurrentEditor();
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      bullets: current?.isActive("bulletList") ?? false,
      code: current?.isActive("code") ?? false,
      formula: current?.isActive("mathInline") ?? false,
      italic: current?.isActive("italic") ?? false,
      link: current?.isActive("link") ?? false,
      numbers: current?.isActive("orderedList") ?? false,
    }),
  });

  return (
    <div className="-ms-1.5 flex min-w-0 flex-wrap items-center gap-0.5">
      <EditorTools
        tools={[
          {
            active: state?.bold ?? false,
            icon: TextBoldIcon,
            label: labels.bold,
            name: "bold",
            run: () => editor?.chain().focus().toggleBold().run(),
          },
          {
            active: state?.italic ?? false,
            icon: TextItalicIcon,
            label: labels.italic,
            name: "italic",
            run: () => editor?.chain().focus().toggleItalic().run(),
          },
          {
            active: state?.code ?? false,
            icon: SourceCodeIcon,
            label: labels.code,
            name: "code",
            run: () => editor?.chain().focus().toggleCode().run(),
          },
          {
            active: state?.bullets ?? false,
            icon: LeftToRightListBulletIcon,
            label: labels.bullets,
            name: "bullets",
            run: () => editor?.chain().focus().toggleBulletList().run(),
          },
          {
            active: state?.numbers ?? false,
            icon: LeftToRightListNumberIcon,
            label: labels.numbers,
            name: "numbers",
            run: () => editor?.chain().focus().toggleOrderedList().run(),
          },
          {
            active: state?.formula ?? false,
            icon: FunctionIcon,
            label: labels.formula,
            name: "formula",
            run: () =>
              editor?.chain().focus().toggleFormula("mathInline").run(),
          },
        ]}
      />
      <RichEditorLink
        active={state?.link ?? false}
        invalid={labels.linkInvalid}
        label={labels.link}
        placeholder={labels.linkPlaceholder}
      />
    </div>
  );
}

/** Inserts text at the caret of the surrounding editor, such as an emoji a learner picked. */
export function useInsertText() {
  const { editor } = useCurrentEditor();
  return (text: string) => editor?.chain().focus().insertContent(text).run();
}

interface LearnerEditorProps {
  /** Whether the caret goes to the end of the text once the editor exists. */
  autoFocus: boolean;
  /** The actions at the end of the bar, such as an emoji, a photo and the send button. They read the editor with `useCurrentEditor`. */
  children: ReactNode;
  /**
   * The Markdown the editor starts with. Once the editor exists it owns the text and reports every edit
   * through `onChange`, so a later change of this prop does nothing. Mount a new editor to start again.
   */
  defaultValue: string;
  /** The accessible name of the editing surface. */
  label: string;
  /** The names of the controls. */
  labels: LearnerLabels;
  /** The most characters the Markdown of the text may hold. */
  limit: number;
  /** Called with the whole text as Markdown after each edit. */
  onChange: (markdown: string) => void;
  /** Called when the learner presses Escape in the text. */
  onClose: () => void;
  /** Called with the files a learner pastes or drops on the text, which the text itself never holds. */
  onFiles: (files: readonly File[]) => void;
  /** Called when a paste is refused because it would take the Markdown past `limit`. */
  onRefuse: () => void;
  /** Called when the learner presses Mod-Enter, which sends the text. */
  onSubmit: () => void;
  /** The hint shown while the text is empty. */
  placeholder: string;
}

/** The files a paste or a drop carries, which the caller takes instead of the text. */
function carried(transfer: DataTransfer | null) {
  return Arr.fromIterable(transfer?.files ?? []);
}

/**
 * Writes learner text, a comment or a reply, and keeps it as the Markdown the page draws: bold, italic and
 * code words, links, lists and formulas, with the controls in a bar under the text and the caller's actions
 * at the bar's end, as a chat's composer. Mod-Enter sends, Escape closes, and a pasted or dropped file goes
 * to `onFiles`. Load it with `import()` where the learner opens it, not with the page, because it brings the
 * editing library with it.
 */
export function LearnerEditor({
  autoFocus,
  children,
  defaultValue,
  label,
  labels,
  limit,
  onChange,
  onClose,
  onFiles,
  onRefuse,
  onSubmit,
  placeholder,
}: LearnerEditorProps) {
  const change = useCallbackRef(onChange);
  const close = useCallbackRef(onClose);
  const files = useCallbackRef(onFiles);
  const refuse = useCallbackRef(onRefuse);
  const submit = useCallbackRef(onSubmit);
  const [content] = useState(defaultValue);
  const options = useMemo(
    () => learnerOptions({ limit, onRefuse: refuse, placeholder }),
    [limit, placeholder, refuse]
  );
  const editorProps = useMemo<EditorProps>(
    () => ({
      attributes: {
        "aria-label": label,
        "aria-multiline": "true",
        class: cn(
          editorPlaceholder(),
          learnerTextVariants(),
          "wrap-anywhere outline-none"
        ),
        "data-slot": "input-group-control",
        role: "textbox",
      },
      handleDrop: (_view, event) => {
        const dropped = carried(event.dataTransfer);
        if (Arr.isReadonlyArrayEmpty(dropped)) {
          return false;
        }
        files(dropped);
        return true;
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Escape") {
          close();
          return true;
        }
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          submit();
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const pasted = carried(event.clipboardData);
        if (Arr.isReadonlyArrayEmpty(pasted)) {
          return false;
        }
        files(pasted);
        return true;
      },
    }),
    [close, files, label, submit]
  );
  const editor = useEditor({
    ...options,
    content,
    contentType: "markdown",
    editorProps,
    immediatelyRender: false,
    onCreate: ({ editor: created }) => {
      if (autoFocus) {
        placeCaret(created, document.activeElement);
      }
    },
    onUpdate: ({ editor: current }) => change(current.getMarkdown()),
  });
  const context = useMemo(() => ({ editor }), [editor]);

  return (
    <EditorContext value={context}>
      <LearnerLabelsContext value={labels}>
        <FormulaLabelsProvider labels={labels.formulaEdit}>
          <InputGroup className={learnerFrame()}>
            <EditorContent className={learnerText()} editor={editor} />
            <InputGroupAddon align="block-end">
              <LearnerTools />
              <div className="ms-auto flex shrink-0 items-center gap-1">
                {children}
              </div>
            </InputGroupAddon>
          </InputGroup>
        </FormulaLabelsProvider>
      </LearnerLabelsContext>
    </EditorContext>
  );
}
