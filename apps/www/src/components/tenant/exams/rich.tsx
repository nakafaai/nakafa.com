import { QueryResult, useQuery } from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import {
  DocumentEditor,
  type DocumentEditorInstance,
} from "@repo/design-system/components/editor/document";
import { FormulaLabelsProvider } from "@repo/design-system/components/editor/formula";
import {
  PicturesProvider,
  pictureFileHandler,
} from "@repo/design-system/components/editor/picture";
import type { Transaction } from "@tiptap/pm/state";
import { Array as Arr, Record as Rec } from "effect";
import {
  type ComponentProps,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { queuePictureFile } from "@/components/tenant/exams/picture";
import { useExam, useExamEditing } from "@/components/tenant/exams/provider";
import { useDocumentLabels } from "@/lib/editor/labels";
import { pictureIdsPlugin } from "@/lib/editor/pictures";

/** The extensions of one rich text, the shared ones among them. */
type ExamExtensions = ComponentProps<typeof DocumentEditor>["extensions"];

/** The props of one rich text of the exam editor, which the prompt and each option share. */
interface ExamDocumentProps {
  /** The extensions of this text, built once by the caller, on top of the shared ones. */
  readonly extensions: ExamExtensions;
  /** The accessible name of the text. */
  readonly label: string;
  /** Called after each transaction of the text, including one another editor brought in. */
  readonly onChange: (transaction: Transaction) => void;
  /** Called once with the editor, as soon as it exists. */
  readonly onEditor: (editor: DocumentEditorInstance) => void;
  /** The hint shown while the text is empty. */
  readonly placeholder: string;
  /** The room the text takes at least: an option takes one line, and a prompt a page of writing. */
  readonly size?: "line" | "page";
}

/**
 * One rich text of the exam editor: the prompt of a question or the label of one option. It takes
 * the pictures and formulas of its document, and it makes its editor the one the toolbar acts on
 * when the editor takes focus. A picture pasted or dropped into the text waits for its alt text in
 * the exam's queue, which inserts it into this editor. The editor gives its place up when it is
 * removed.
 */
export function ExamDocument({
  extensions,
  label,
  onChange,
  onEditor,
  placeholder,
  size = "page",
}: ExamDocumentProps) {
  const { exam, slug } = useExam();
  const labels = useDocumentLabels();
  const activate = useExamEditing((state) => state.activate);
  const release = useExamEditing((state) => state.release);
  const queuePicture = useExamEditing((state) => state.queuePicture);
  // The editor of this text, once it exists, which its own removal gives up.
  const own = useRef<DocumentEditorInstance | null>(null);
  // The images the text holds, which resolve to addresses in one read.
  const [pictureIds, setPictureIds] = useState<readonly Id<"examAssets">[]>([]);
  const pictureUrls = useQuery(
    exams.assets.urls,
    pictureIds.length === 0
      ? "skip"
      : { assets: pictureIds, examId: exam.id, slug }
  );
  const addresses = useMemo(
    () =>
      QueryResult.isSuccess(pictureUrls)
        ? Rec.fromEntries(
            Arr.map(
              pictureUrls.value,
              (asset) => [asset.id, asset.url] as const
            )
          )
        : {},
    [pictureUrls]
  );
  const allExtensions = useMemo(
    () => [
      ...extensions,
      pictureFileHandler((file, editor) =>
        queuePictureFile(queuePicture, editor, file)
      ),
    ],
    [extensions, queuePicture]
  );

  // The place of a removed editor goes to nobody, so the toolbar never acts on it.
  useEffect(
    () => () => {
      const editor = own.current;
      if (editor !== null) {
        release(editor);
      }
    },
    [release]
  );

  return (
    <FormulaLabelsProvider labels={labels.formulaEdit}>
      <PicturesProvider
        begin={noBegin}
        labels={labels.pictures}
        urls={addresses}
      >
        <DocumentEditor
          extensions={allExtensions}
          label={label}
          onChange={onChange}
          onEditor={(editor) => {
            own.current = editor;
            editor.registerPlugin(pictureIdsPlugin(setPictureIds));
            onEditor(editor);
          }}
          onFocus={activate}
          placeholder={placeholder}
          size={size}
        />
      </PicturesProvider>
    </FormulaLabelsProvider>
  );
}

/** A text takes no picture of its own through its provider, since the exam's queue takes them. */
const noBegin = () => undefined;
