import { QueryResult, useQuery } from "@confect/react";
import { useInViewport } from "@mantine/hooks";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { Id } from "@repo/backend/confect/_generated/id";
import editors from "@repo/backend/confect/_generated/refs/editor";
import exams from "@repo/backend/confect/_generated/refs/exams";
import {
  letterScript,
  optionLetter,
  optionLetters,
} from "@repo/backend/confect/exams/letters";
import {
  CHOICE_OPTIONS_MAX,
  fixedOptions,
} from "@repo/backend/confect/exams/question";
import {
  editorContent,
  editorDocument,
  editorPlaceholder,
} from "@repo/design-system/components/editor/frame";
import { Node } from "@tiptap/pm/model";
import { cn } from "cn";
import { Array as Arr, Effect, HashMap, Option } from "effect";
import { useDeferredValue, useMemo } from "react";
import { useTranslations } from "use-intl";
import { DrawnDocument } from "@/components/assessment/drawn";
import {
  addressesOf,
  SittingPictures,
} from "@/components/exams/sitting/pictures";
import { ChoiceGroup } from "@/components/exams/sitting/reason";
import {
  type Choice,
  isChoice,
  type OptionLabel,
} from "@/components/tenant/exams/answer";
import { matchOf } from "@/components/tenant/exams/match";
import type { Question } from "@/components/tenant/exams/optimistic";
import { isPlaceholderId } from "@/components/tenant/exams/placeholder";
import {
  useExam,
  useExamLive,
  useExamLocked,
} from "@/components/tenant/exams/provider";
import { choiceTitle } from "@/components/tenant/exams/reason";
import {
  OptionAddRoom,
  PaperField,
  PaperOption,
  PaperOptions,
  PaperPairSelect,
  PaperPairs,
  PaperPart,
  PaperParts,
  PaperPartText,
  QuestionPaper,
} from "@/components/tenant/exams/sheet";
import { tableOf } from "@/components/tenant/exams/table";
import { LetteredChoice } from "@/components/tryout/runtime/choice/surface";
import { TryoutChoiceTable } from "@/components/tryout/runtime/choice/table";
import { useLastValue } from "@/lib/data/kept";
import { assessmentSchema } from "@/lib/editor/assessment";
import { foldedDocument } from "@/lib/editor/fold";
import { assetIdsOf } from "@/lib/editor/pictures";

/**
 * The session name the editor reads a prompt under to draw it without an editor. It never writes, so the
 * server holds no record of it, and the read answers the document alone.
 */
const PREVIEW_CLIENT = "preview";

/**
 * A rich text of a question as a document to draw: the one its editor holds when the question is
 * open, and otherwise the one the server holds, or the one the editor held last until the server
 * answers. The server's document is read only when `read` is set, so an off-screen page reads
 * nothing; a text whose question the server has not saved yet reads nothing either. While the page's
 * editors load, the server's document is still read until the text's editor holds it, so the drawn
 * paper that stands in for the loading editor shows the text instead of an empty page.
 */
export const usePageDocument = (page: Parameters<typeof usePageRead>[0]) =>
  usePageRead(page).doc;

/** `usePageDocument`, with whether the text has answered, so a page knows when its shape is final. */
export function usePageRead({
  documentId,
  editing,
  open,
  read,
  saved,
}: {
  /** The document of the text: the prompt, the rubric, or the explanation of a question. */
  documentId: Id<"editorDocuments">;
  /** Whether the page's editors are mounted, which take the text over once each holds it. */
  editing: boolean;
  /** Whether the question is the one the teacher works on, which draws its editor's document first. */
  open: boolean;
  /** Whether the server's document may be read now. */
  read: boolean;
  /** Whether the server has saved the question. */
  saved: boolean;
}) {
  const { slug } = useExam();
  // Each text follows its own document alone: the selector keeps the document's reference, so
  // typing in one text redraws that text alone.
  const live = Option.fromNullishOr(
    useExamLive((state) =>
      Option.getOrUndefined(HashMap.get(state.docs, documentId))
    )
  );
  const reply = useQuery(
    editors.documents.open,
    !(saved && read) ||
      isPlaceholderId(documentId) ||
      ((open || editing) && Option.isSome(live))
      ? "skip"
      : { clientId: PREVIEW_CLIENT, documentId, slug }
  );
  // A document removed with its exam fails its read, and the drawing keeps the text the server last answered.
  const kept = useLastValue(reply);
  const stored = Option.getOrUndefined(kept);
  // A document this build cannot read leaves its drawing without a prompt; the editor reports the
  // failure when the question opens. The stored steps are folded once per answer of the server.
  const served = useMemo(
    () =>
      stored === undefined
        ? Option.none()
        : Effect.runSync(
            foldedDocument(assessmentSchema, stored).pipe(
              Effect.asSome,
              Effect.catchTag("SyncFailed", () => Effect.succeedNone)
            )
          ),
    [stored]
  );
  // A skipped or loading read prefers the editor's text, which is newer, and keeps the last answer
  // when no editor holds the text, so a drawing never empties while it reads again.
  const doc =
    open || QueryResult.isLoading(reply)
      ? Option.orElse(live, () => served)
      : Option.orElse(served, () => live);
  return { answered: Option.isSome(doc) || !QueryResult.isLoading(reply), doc };
}

/** A question's shared reading drawn without an editor, over its prompt. */
export function ReadingSketch({
  documentId,
  read,
}: {
  readonly documentId: Id<"editorDocuments">;
  /** Whether the server's document may be read now. */
  readonly read: boolean;
}) {
  const doc = usePageDocument({
    documentId,
    editing: false,
    open: false,
    read,
    saved: true,
  });

  return <PreviewProse article doc={doc} size="paper" />;
}

/** The document a text draws while its document is not known: one empty paragraph, as an editor holds one. */
const EMPTY_TEXT = Node.fromJSON(assessmentSchema, {
  content: [{ type: "paragraph" }],
  type: "doc",
});

/** The addresses of the images a drawn text holds, in one read, by image ID. */
function useDrawnPictures(doc: Node) {
  const { exam, slug } = useExam();
  const assets = useMemo(() => assetIdsOf(doc), [doc]);
  const reply = useQuery(
    exams.assets.urls,
    Arr.isReadonlyArrayEmpty(assets)
      ? "skip"
      : { assets, examId: exam.id, slug }
  );

  return useMemo(
    () => (QueryResult.isSuccess(reply) ? addressesOf(reply.value) : {}),
    [reply]
  );
}

/**
 * A rich text drawn with the student's own nodes (`DrawnDocument`), in the wrapper the editor gives its text, so
 * the text takes the same box and spacing as it does once the editor mounts, and as the student reads it. A text
 * that changes while the teacher types is drawn when the browser has time. `article` gives each paragraph
 * the classes the article's paragraphs take, which the prompt and the notes of a question take in their
 * editors, and an option does not.
 */
export function PreviewProse({
  article,
  doc,
  size,
}: {
  article: boolean;
  doc: Option.Option<Node>;
  size: "line" | "page" | "paper";
}) {
  const latest = Option.getOrElse(doc, () => EMPTY_TEXT);
  const deferred = useDeferredValue(latest);
  // A text that just arrived draws at once, so the page takes its shape in one frame, and nothing below it moves.
  const shown = deferred === EMPTY_TEXT ? latest : deferred;
  const urls = useDrawnPictures(shown);

  return (
    <div className={editorContent({ size })}>
      <SittingPictures value={urls}>
        <DrawnDocument
          className={cn(
            editorPlaceholder(),
            editorDocument({ size, text: "article" })
          )}
          doc={shown}
          paragraphs={article}
        />
      </SittingPictures>
    </div>
  );
}

/** The label of one option drawn without an editor, at the size an option's editor takes. */
export function OptionSketch({ label }: { label: OptionLabel }) {
  const doc = useMemo(
    () => Option.some(Node.fromJSON(assessmentSchema, label)),
    [label]
  );

  return <PreviewProse article={false} doc={doc} size="line" />;
}

/**
 * One column of a matching or a table question drawn without editors, as its live column draws it: its
 * heading, its parts numbered or lettered, and the room of the action that adds a part when it takes one.
 */
function PartSketch({
  adds,
  letterOf,
  pairs,
  parts,
  withControls,
}: {
  adds: boolean;
  letterOf: (index: number) => string;
  pairs: boolean;
  parts: readonly { readonly id: string; readonly label: OptionLabel }[];
  withControls: boolean;
}) {
  const locked = useExamLocked();

  return (
    <div className="grid content-start gap-2">
      <PaperParts>
        {Arr.map(parts, (part, index) => (
          <PaperPart
            below={pairs ? <PaperPairSelect /> : null}
            key={part.id}
            name={letterOf(index)}
          >
            <OptionSketch label={part.label} />
          </PaperPart>
        ))}
      </PaperParts>
      {withControls && adds && !locked && parts.length < CHOICE_OPTIONS_MAX ? (
        <OptionAddRoom />
      ) : null}
    </div>
  );
}

/**
 * A true or false table drawn without editors, as its live table draws it: the statements' heading and each
 * column's header, then each numbered statement with an empty mark under every column.
 */
function TableSketch({
  table,
}: {
  table: Extract<Interaction, { kind: "matrix" }>;
}) {
  const t = useTranslations("Exams");

  return (
    <TryoutChoiceTable
      columns={Arr.map(table.columns, (column) => ({
        id: column.id,
        label: <OptionSketch label={column.label} />,
      }))}
      disabled
      label={table.label}
      statementLabel={t("statement-placeholder")}
      statements={Arr.map(table.statements, (statement) => ({
        id: statement.id,
        label: <OptionSketch label={statement.label} />,
        marked: undefined,
      }))}
    />
  );
}

/** The number that names a statement by its place: 1 for the first, 2 for the second, and so on. */
const statementNumber = (index: number) => String(index + 1);

/**
 * The answers of one question drawn without editors, as the student reads them, below the prompt that
 * the caller draws on the same paper (`PreviewProse`). The page draws them when its editors are not
 * mounted, and the thumbnails draw them small, so a page and its thumbnail look alike. A page passes
 * `withControls`, which keeps the room of the action that adds an option, so the paper is as tall as it
 * is when the editor mounts.
 */
export function PaperSketch({
  question,
  withControls = false,
}: {
  question: Question;
  withControls?: boolean;
}) {
  const locked = useExamLocked();
  // A template that fixes its options takes no added option, so its page keeps no room for the action.
  const addsOption =
    withControls && !locked && Option.isNone(fixedOptions(question.template));

  return (
    <>
      {Arr.map(Arr.filter(question.answers, isChoice), (choice) => (
        <ChoiceSketch
          adds={addsOption && choice.options.length < CHOICE_OPTIONS_MAX}
          choice={choice}
          key={choice.id}
          template={question.template}
        />
      ))}
      {Option.match(matchOf(question.answers), {
        onNone: () => null,
        onSome: (match) => (
          <PaperPairs>
            <PartSketch
              adds
              letterOf={statementNumber}
              pairs
              parts={match.sources}
              withControls={withControls}
            />
            <PartSketch
              adds
              letterOf={(index) =>
                optionLetter(
                  index,
                  letterScript(Arr.map(match.targets, (part) => part.label))
                )
              }
              pairs={false}
              parts={match.targets}
              withControls={withControls}
            />
          </PaperPairs>
        ),
      })}
      {Option.match(tableOf(question.answers), {
        onNone: () => null,
        onSome: (table) => <TableSketch table={table} />,
      })}
      <PaperField answers={question.answers} />
    </>
  );
}

/** One choice of a page drawn without its editors, a reason under its name, as the page draws it with them. */
function ChoiceSketch({
  adds,
  choice,
  template,
}: {
  /** Whether the page keeps the room of the action that adds an option. */
  readonly adds: boolean;
  readonly choice: Choice;
  /** The question's template, which names its choices when it holds two. */
  readonly template: Question["template"];
}) {
  const letterOf = optionLetters(
    Arr.map(choice.options, (option) => option.label)
  );

  return (
    <>
      <ChoiceGroup title={choiceTitle(template, choice.id)}>
        <PaperOptions>
          {Arr.map(choice.options, (option, index) => (
            <PaperOption key={option.id} multiple={choice.maxChoices !== 1}>
              <LetteredChoice letter={letterOf(index)}>
                <PaperPartText>
                  <OptionSketch label={option.label} />
                </PaperPartText>
              </LetteredChoice>
            </PaperOption>
          ))}
        </PaperOptions>
      </ChoiceGroup>
      {adds ? <OptionAddRoom /> : null}
    </>
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
  const doc = usePageDocument({
    documentId: question.prompt,
    editing: false,
    open,
    read: inViewport,
    saved,
  });

  return (
    <div className="absolute inset-0 overflow-hidden" ref={ref}>
      <div
        aria-hidden
        className="pointer-events-none w-4/1 origin-top-left scale-25 p-4 text-start"
        inert
      >
        <QuestionPaper>
          <PreviewProse article doc={doc} size="paper" />
          <PaperSketch question={question} />
        </QuestionPaper>
      </div>
    </div>
  );
}
