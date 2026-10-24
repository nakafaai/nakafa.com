import { QueryResult, useQuery } from "@confect/react";
import { useInViewport } from "@mantine/hooks";
import editors from "@repo/backend/confect/_generated/refs/editor";
import {
  editorContent,
  editorDocument,
  editorPlaceholder,
} from "@repo/design-system/components/editor/frame";
import { paragraphVariants } from "@repo/design-system/lib/paragraph";
import { DOMSerializer, Node } from "@tiptap/pm/model";
import { cn } from "cn";
import { Array as Arr, Effect, HashMap, Option } from "effect";
import { useCallback, useDeferredValue, useMemo } from "react";
import {
  choiceOf,
  type OptionLabel,
  optionLetter,
} from "@/components/tenant/exams/answer";
import type { Question } from "@/components/tenant/exams/optimistic";
import { isPlaceholderId } from "@/components/tenant/exams/placeholder";
import { useExam, useExamLive } from "@/components/tenant/exams/provider";
import {
  ControlRoom,
  PaperOption,
  PaperOptions,
  QuestionPaper,
} from "@/components/tenant/exams/sheet";
import { assessmentSchema } from "@/lib/editor/assessment";
import { foldedDocument } from "@/lib/editor/fold";

/**
 * The session name a thumbnail reads a prompt under. It never writes, so the server holds no
 * record of it, and the read answers the document alone.
 */
const PREVIEW_CLIENT = "preview";

/**
 * The prompt of one question as a document to draw: the one its editor holds when the question is
 * open, and otherwise the one the server holds, or the one the editor held last until the server
 * answers. The server's document is read only when `read` is set, so an off-screen page reads
 * nothing; a question the server has not saved yet reads nothing either.
 */
export function usePromptDocument({
  open,
  question,
  read,
  saved,
}: {
  /** Whether the question is the one the teacher works on, which draws its editor's document first. */
  open: boolean;
  question: Question;
  /** Whether the server's document may be read now. */
  read: boolean;
  /** Whether the server has saved the question. */
  saved: boolean;
}): Option.Option<Node> {
  const { slug } = useExam();
  // Each question follows its own prompt alone: the selector keeps the document's reference, so
  // typing in one question redraws that question alone.
  const live = Option.fromNullishOr(
    useExamLive((state) =>
      Option.getOrUndefined(HashMap.get(state.docs, question.prompt))
    )
  );
  const reply = useQuery(
    editors.documents.open,
    !(saved && read) ||
      isPlaceholderId(question.prompt) ||
      (open && Option.isSome(live))
      ? "skip"
      : { clientId: PREVIEW_CLIENT, documentId: question.prompt, slug }
  );
  // A document this build cannot read leaves its drawing without a prompt; the editor reports the
  // failure when the question opens. The stored steps are folded once per answer of the server.
  const served = useMemo(
    () =>
      QueryResult.isSuccess(reply)
        ? Effect.runSync(
            foldedDocument(assessmentSchema, reply.value).pipe(
              Effect.asSome,
              Effect.catchTag("SyncFailed", () => Effect.succeedNone)
            )
          )
        : Option.none(),
    [reply]
  );
  return open
    ? Option.orElse(live, () => served)
    : Option.orElse(served, () => live);
}

/**
 * A rich text drawn without an editor: the schema's own rendering of each node, which is what the
 * editor draws, in the wrapper and the document classes the editor gives its text, so the text takes
 * the same box and spacing as it does once the editor mounts. A text that changes while the teacher
 * types is drawn when the browser has time.
 */
function PreviewProse({ doc, size }: { doc: Node; size: "line" | "page" }) {
  const shown = useDeferredValue(doc);
  // The text is drawn again only when it changes, not on every redraw of the page. An option's text
  // takes the paragraph classes of no paragraph, as its editor does, so its first line keeps the line
  // box of the letter.
  const draw = useCallback(
    (element: HTMLDivElement | null) => {
      if (element === null) {
        return;
      }
      element.replaceChildren(
        DOMSerializer.fromSchema(shown.type.schema).serializeFragment(
          shown.content
        )
      );
      if (size === "line") {
        return;
      }
      Arr.forEach(Arr.fromIterable(element.querySelectorAll("p")), (p) => {
        p.className = paragraphVariants();
      });
    },
    [shown, size]
  );

  return (
    <div className={editorContent({ size })}>
      <div
        className={cn(editorPlaceholder(), editorDocument({ size }))}
        ref={draw}
      />
    </div>
  );
}

/** The label of one option drawn without an editor, at the size an option's editor takes. */
function OptionSketch({ label }: { label: OptionLabel }) {
  const doc = useMemo(() => Node.fromJSON(assessmentSchema, label), [label]);

  return <PreviewProse doc={doc} size="line" />;
}

/**
 * One option of a paper drawn without editors: its letter and its text. A page with controls keeps
 * the room of its option controls beside the text, as the editor's page does.
 */
function PaperChoice({
  label,
  letter,
  withControls,
}: {
  label: OptionLabel;
  letter: string;
  withControls: boolean;
}) {
  const option = (
    <PaperOption letter={letter}>
      <OptionSketch label={label} />
    </PaperOption>
  );

  if (!withControls) {
    return option;
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
      {option}
      <div aria-hidden className="flex items-center gap-1">
        <ControlRoom />
        <ControlRoom />
      </div>
    </div>
  );
}

/**
 * The paper of one question drawn without editors: its prompt and its options as the student reads
 * them. The page draws it when its editors are not mounted, and the thumbnails draw it small, so a
 * page and its thumbnail look alike. A page passes `withControls`, which keeps the room of its option
 * controls, so an option is as wide on the paper as it is when the editor mounts.
 */
export function PaperSketch({
  doc,
  question,
  withControls = false,
}: {
  doc: Option.Option<Node>;
  question: Question;
  withControls?: boolean;
}) {
  const choice = choiceOf(question.answers);

  return (
    <QuestionPaper>
      {Option.isSome(doc) ? <PreviewProse doc={doc.value} size="page" /> : null}
      {Option.isSome(choice) ? (
        <PaperOptions>
          {Arr.map(choice.value.options, (option, index) => (
            <PaperChoice
              key={option.id}
              label={option.label}
              letter={optionLetter(index)}
              withControls={withControls}
            />
          ))}
        </PaperOptions>
      ) : null}
    </QuestionPaper>
  );
}

/**
 * One question as a thumbnail: its paper drawn at a quarter of the size, inert, since the strip's
 * button names the question. The open question draws what its editor holds, so the thumbnail
 * changes as the teacher types. Any other question reads its prompt once it scrolls into view.
 */
export function QuestionPreview({
  open,
  question,
  saved,
}: {
  open: boolean;
  question: Question;
  /** Whether the server has saved the question; a placeholder's prompt has no document to read yet. */
  saved: boolean;
}) {
  const { inViewport, ref } = useInViewport();
  const doc = usePromptDocument({ open, question, read: inViewport, saved });

  return (
    <div className="absolute inset-0 overflow-hidden" ref={ref}>
      <div
        aria-hidden
        className="pointer-events-none w-4/1 origin-top-left scale-25 p-4"
        inert
      >
        <PaperSketch doc={doc} question={question} />
      </div>
    </div>
  );
}
