"use client";

import { QueryResult, useQuery } from "@confect/react";
import { useInViewport } from "@mantine/hooks";
import editors from "@repo/backend/confect/_generated/refs/editor";
import { paragraphVariants } from "@repo/design-system/lib/paragraph";
import { DOMSerializer, Node } from "@tiptap/pm/model";
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
 * editor draws, with the paragraph classes the editor decorates its paragraphs with. A text that
 * changes while the teacher types is drawn when the browser has time.
 */
export function PreviewProse({ doc }: { doc: Node }) {
  const shown = useDeferredValue(doc);
  // The text is drawn again only when it changes, not on every redraw of the page.
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
      Arr.forEach(Arr.fromIterable(element.querySelectorAll("p")), (p) => {
        p.className = paragraphVariants();
      });
    },
    [shown]
  );

  return <div className="wrap-break-word whitespace-pre-wrap" ref={draw} />;
}

/** The label of one option drawn without an editor. */
export function OptionSketch({ label }: { label: OptionLabel }) {
  const doc = useMemo(() => Node.fromJSON(assessmentSchema, label), [label]);

  return <PreviewProse doc={doc} />;
}

/**
 * The paper of one question drawn without editors: its prompt and its options as the student reads
 * them. The page draws it when its editors are not mounted, and the thumbnails draw it small, so a
 * page and its thumbnail look alike.
 */
function PaperSketch({
  doc,
  question,
}: {
  doc: Option.Option<Node>;
  question: Question;
}) {
  const choice = choiceOf(question.answers);

  return (
    <QuestionPaper>
      {Option.isSome(doc) ? <PreviewProse doc={doc.value} /> : null}
      {Option.isSome(choice) ? (
        <PaperOptions>
          {Arr.map(choice.value.options, (option, index) => (
            <PaperOption key={option.id} letter={optionLetter(index)}>
              <OptionSketch label={option.label} />
            </PaperOption>
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
