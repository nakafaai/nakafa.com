import { FunctionIcon, FunctionSquareIcon } from "@hugeicons/core-free-icons";
import { useCallbackRef } from "@mantine/hooks";
import { EditorArabicKeyboard } from "@repo/design-system/components/editor/arabic";
import { RichEditorLists } from "@repo/design-system/components/editor/block";
import type { FormulaEdit } from "@repo/design-system/components/editor/edit";
import { RichEditorMarks } from "@repo/design-system/components/editor/format";
import {
  FORMULA_VIEWS,
  FormulaLabelsProvider,
} from "@repo/design-system/components/editor/formula";
import {
  editorDocument,
  editorFrame,
  editorPlaceholder,
  editorScroll,
} from "@repo/design-system/components/editor/frame";
import { TASK_VIEW } from "@repo/design-system/components/editor/task";
import { EditorBar } from "@repo/design-system/components/editor/toolbar";
import {
  EditorTools,
  RichEditorHistory,
} from "@repo/design-system/components/editor/tools";
import { EditorPreview } from "@repo/design-system/components/editor/words";
import { answerOptions } from "@repo/design-system/components/editor/written";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import type { EditorProps } from "@tiptap/pm/view";
import {
  EditorContent,
  EditorContext,
  useCurrentEditor,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import { cn } from "cn";
import {
  type ComponentProps,
  createContext,
  use,
  useEffect,
  useMemo,
  useState,
} from "react";

/** The names of an answer's toolbar and of the formula editor its formulas open. */
interface AnswerLabels {
  readonly formulaEdit: ComponentProps<typeof FormulaEdit>["labels"];
  readonly toolbar: ComponentProps<typeof RichEditorHistory>["labels"] &
    ComponentProps<typeof RichEditorLists>["labels"] &
    ComponentProps<typeof RichEditorMarks>["labels"] & {
      /** The control that opens the Arabic keypad. */
      arabic: string;
      /** A formula on a line of its own. */
      equation: string;
      /** A formula inside a line of text. */
      formula: string;
      /** The control that opens the groups the row has no room for. */
      more: string;
    };
}

/** The names of the answer's controls, which the editor provides to its toolbar. */
const AnswerLabelsContext = createContext<AnswerLabels["toolbar"] | null>(null);

/** Selects the names of the answer's controls from the editor around them. */
function useAnswerLabels() {
  const labels = use(AnswerLabelsContext);
  if (labels === null) {
    // A missing editor is a programmer composition error at this React seam.
    throw new Error("The answer toolbar requires AnswerEditor.");
  }
  return labels;
}

/**
 * The formula controls of an answer: a formula inside the line and one on a line of its own, each pressed while
 * one is selected. With text selected a control turns it into a formula, and with nothing selected it inserts a
 * formula whose editor opens at once, with the exam editor's formula field, keypad and LaTeX view.
 */
function AnswerFormulas() {
  const labels = useAnswerLabels();
  const { editor } = useCurrentEditor();
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      equation: current?.isActive("mathBlock") ?? false,
      formula: current?.isActive("mathInline") ?? false,
    }),
  });

  return (
    <EditorTools
      tools={[
        {
          active: state?.formula ?? false,
          icon: FunctionIcon,
          label: labels.formula,
          name: "formula",
          run: () => editor?.chain().focus().toggleFormula("mathInline").run(),
        },
        {
          active: state?.equation ?? false,
          icon: FunctionSquareIcon,
          label: labels.equation,
          name: "equation",
          run: () => editor?.chain().focus().toggleFormula("mathBlock").run(),
        },
      ]}
    />
  );
}

/** The bar above an answer: history, the marks, the lists, the formulas, and the Arabic keypad. */
function AnswerToolbar() {
  const labels = useAnswerLabels();
  return (
    <EditorBar
      groups={[
        { name: "history", tools: <RichEditorHistory labels={labels} /> },
        { name: "marks", tools: <RichEditorMarks labels={labels} /> },
        { name: "lists", tools: <RichEditorLists labels={labels} /> },
        { name: "formulas", tools: <AnswerFormulas /> },
        {
          name: "arabic",
          tools: <EditorArabicKeyboard label={labels.arabic} />,
        },
      ]}
      more={labels.more}
    />
  );
}

/**
 * A learner's written answer, such as an essay: the words with their marks and lists, and formulas written with the
 * exam editor's formula editor, kept as Markdown that the page's reader draws (a formula as `$$x$$` in its line,
 * and as a `math` fence on its own line). It opens on `text`, reports every edit through `onChange`, and `onBlur`
 * when the learner leaves it. A `saved` text that differs from what it shows, written in another tab, takes its
 * place unless the learner is typing in it. A locked answer is read only.
 *
 * Load it with `import()` where the answer shows, not with the page, because it brings the editing library and the
 * formula field with it. Until the editor exists the text shows in its place, drawn as the editor draws it.
 */
export function AnswerEditor({
  labelledBy,
  labels,
  limit,
  locked,
  onBlur,
  onChange,
  onRefuse,
  placeholder,
  saved,
  text,
}: {
  /** The id of the element that names the answer, such as the question's heading. */
  labelledBy: string;
  labels: AnswerLabels;
  /** The most characters the Markdown of the answer may hold. */
  limit: number;
  locked: boolean;
  onBlur: () => void;
  onChange: (markdown: string) => void;
  /** Called when a paste is refused because it would take the Markdown past `limit`, so the learner hears why. */
  onRefuse: () => void;
  placeholder: string;
  /** The text the server holds now, which a save from another tab changes. */
  saved: string;
  /** The text the editor opens with. */
  text: string;
}) {
  const change = useCallbackRef(onChange);
  const leave = useCallbackRef(onBlur);
  const [content] = useState(text);
  const refuse = useCallbackRef(onRefuse);
  const options = useMemo(
    () =>
      answerOptions({
        formulaViews: FORMULA_VIEWS,
        limit,
        onRefuse: refuse,
        placeholder,
        taskView: TASK_VIEW,
      }),
    [limit, placeholder, refuse]
  );
  const editorProps = useMemo<EditorProps>(
    () => ({
      attributes: {
        "aria-labelledby": labelledBy,
        "aria-multiline": "true",
        role: "textbox",
        class: cn(editorPlaceholder(), editorDocument()),
      },
    }),
    [labelledBy]
  );
  const editor = useEditor({
    ...options,
    content,
    contentType: "markdown",
    editable: !locked,
    editorProps,
    immediatelyRender: false,
    onBlur: () => leave(),
    onUpdate: ({ editor: current }) => change(current.getMarkdown()),
  });
  const context = useMemo(() => ({ editor }), [editor]);

  useEffect(() => {
    editor?.setEditable(!locked);
  }, [editor, locked]);

  // Words saved from another tab take the editor's place, unless the learner is typing here.
  useEffect(() => {
    if (editor === null || editor.isFocused || editor.getMarkdown() === saved) {
      return;
    }
    editor.commands.setContent(saved, {
      contentType: "markdown",
      emitUpdate: false,
    });
  }, [editor, saved]);

  if (editor === null) {
    return <EditorPreview markdown={content} placeholder={placeholder} />;
  }

  return (
    <EditorContext value={context}>
      <AnswerLabelsContext value={labels.toolbar}>
        <FormulaLabelsProvider labels={labels.formulaEdit}>
          <div className={editorFrame()} data-slot="editor">
            {locked ? null : <AnswerToolbar />}
            <ScrollArea className="flex-1">
              <EditorContent className={editorScroll()} editor={editor} />
            </ScrollArea>
          </div>
        </FormulaLabelsProvider>
      </AnswerLabelsContext>
    </EditorContext>
  );
}
