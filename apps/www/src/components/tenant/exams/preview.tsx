import { QueryResult, useQuery } from "@confect/react";
import { useInViewport } from "@mantine/hooks";
import type { Id } from "@repo/backend/confect/_generated/id";
import editors from "@repo/backend/confect/_generated/refs/editor";
import {
  CHOICE_OPTIONS_MAX,
  fixedOptions,
} from "@repo/backend/confect/exams/question";
import { markBlockDirections } from "@repo/design-system/components/editor/direction";
import {
  editorContent,
  editorDocument,
  editorPlaceholder,
} from "@repo/design-system/components/editor/frame";
import { drawArticleProse } from "@repo/design-system/components/editor/prose";
import { paragraphVariants } from "@repo/design-system/lib/prose";
import { DOMSerializer, Node } from "@tiptap/pm/model";
import { cn } from "cn";
import { Array as Arr, Effect, HashMap, Option } from "effect";
import { type ReactNode, useCallback, useDeferredValue, useMemo } from "react";
import { useTranslations } from "use-intl";
import {
  choiceOf,
  entryOf,
  type OptionLabel,
  optionLetter,
} from "@/components/tenant/exams/answer";
import { matchOf } from "@/components/tenant/exams/match";
import type { Question } from "@/components/tenant/exams/optimistic";
import { isPlaceholderId } from "@/components/tenant/exams/placeholder";
import {
  useExam,
  useExamLive,
  useExamLocked,
} from "@/components/tenant/exams/provider";
import {
  ControlRoom,
  OptionAddRoom,
  PaperLine,
  PaperOption,
  PaperOptions,
  PaperTable,
  PaperTableHead,
  PaperTableHeader,
  PaperTableMark,
  PaperTableNumber,
  PaperTableStatement,
  QuestionPaper,
} from "@/components/tenant/exams/sheet";
import { tableOf } from "@/components/tenant/exams/table";
import { useLastValue } from "@/lib/data/kept";
import { assessmentSchema } from "@/lib/editor/assessment";
import { foldedDocument } from "@/lib/editor/fold";

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
export function usePageDocument({
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
}): Option.Option<Node> {
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
  // A skipped or loading read draws no server document, so the drawing takes the editor's.
  const stored = QueryResult.isLoading(reply)
    ? undefined
    : Option.getOrUndefined(kept);
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
  return open
    ? Option.orElse(live, () => served)
    : Option.orElse(served, () => live);
}

/** The document a text draws while its document is not known: one empty paragraph, as an editor holds one. */
const EMPTY_TEXT = Node.fromJSON(assessmentSchema, {
  content: [{ type: "paragraph" }],
  type: "doc",
});

/**
 * A rich text drawn without an editor: the schema's own rendering of each node, which is what the
 * editor draws, in the wrapper and the document classes the editor gives its text, so the text takes
 * the same box and spacing as it does once the editor mounts, and each block takes the direction of
 * its own words, as the editor gives it. A text that changes while the teacher types is drawn when
 * the browser has time. Its headings, lists, quotations and code take the published article's classes,
 * as `articleProse` gives them in the editor, and `article` gives each paragraph the classes the
 * article's paragraphs take, which the prompt and the notes of a question take in their editors, and an
 * option does not. An empty
 * paragraph gets the line break an editor gives it, so an empty text keeps the height of its editor.
 */
export function PreviewProse({
  article,
  doc,
  size,
}: {
  article: boolean;
  doc: Option.Option<Node>;
  size: "line" | "page";
}) {
  const shown = useDeferredValue(Option.getOrElse(doc, () => EMPTY_TEXT));
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
      markBlockDirections(element);
      drawArticleProse(element);
      Arr.forEach(Arr.fromIterable(element.querySelectorAll("p")), (p) => {
        if (article) {
          p.className = paragraphVariants();
        }
        if (p.childNodes.length === 0) {
          p.append(document.createElement("br"));
        }
      });
    },
    [article, shown]
  );

  return (
    <div className={editorContent({ size })}>
      <div
        className={cn(
          editorPlaceholder(),
          editorDocument({ size, text: "article" })
        )}
        ref={draw}
      />
    </div>
  );
}

/** The label of one option drawn without an editor, at the size an option's editor takes. */
function OptionSketch({ label }: { label: OptionLabel }) {
  const doc = useMemo(
    () => Option.some(Node.fromJSON(assessmentSchema, label)),
    [label]
  );

  return <PreviewProse article={false} doc={doc} size="line" />;
}

/**
 * One option of a paper drawn without editors: the letter and the text the caller composes. A page with
 * controls keeps the room of the one control an option has beside its text, the remove control, as the
 * editor's page does.
 */
function PaperChoice({
  children,
  withControls,
}: {
  children: ReactNode;
  withControls: boolean;
}) {
  if (!withControls) {
    return children;
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
      {children}
      <div aria-hidden className="flex items-center gap-1">
        <ControlRoom />
      </div>
    </div>
  );
}

/**
 * One column of a matching or a table question drawn without editors, as its live column draws it: its
 * heading, its parts numbered or lettered, and the room of the action that adds a part when it takes one.
 */
function PartSketch({
  adds,
  heading,
  letterOf,
  parts,
  withControls,
}: {
  adds: boolean;
  heading: string;
  letterOf: (index: number) => string;
  parts: readonly { readonly id: string; readonly label: OptionLabel }[];
  withControls: boolean;
}) {
  const locked = useExamLocked();

  return (
    <div className="grid content-start gap-2">
      <p className="font-medium text-muted-foreground text-sm">{heading}</p>
      {Arr.map(parts, (part, index) => (
        <PaperChoice key={part.id} withControls={withControls}>
          <PaperOption letter={letterOf(index)}>
            <OptionSketch label={part.label} />
          </PaperOption>
        </PaperChoice>
      ))}
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
  columns,
  statements,
}: {
  columns: readonly { readonly id: string; readonly label: OptionLabel }[];
  statements: readonly { readonly id: string; readonly label: OptionLabel }[];
}) {
  const t = useTranslations("Exams");

  return (
    <PaperTable columns={columns.length}>
      <PaperTableHead heading={t("match-statements")}>
        {Arr.map(columns, (column) => (
          <PaperTableHeader key={column.id}>
            <OptionSketch label={column.label} />
          </PaperTableHeader>
        ))}
      </PaperTableHead>
      {Arr.map(statements, (statement, index) => (
        <div
          className="col-span-full grid grid-cols-subgrid"
          key={statement.id}
        >
          <PaperTableNumber number={index + 1} />
          <PaperTableStatement>
            <OptionSketch label={statement.label} />
          </PaperTableStatement>
          {Arr.map(columns, (column) => (
            <PaperTableMark key={column.id}>
              <span
                aria-hidden
                className="size-4 rounded-full border border-input bg-background shadow-xs"
              />
            </PaperTableMark>
          ))}
        </div>
      ))}
    </PaperTable>
  );
}

/** The number that names a statement by its place: 1 for the first, 2 for the second, and so on. */
const statementNumber = (index: number) => String(index + 1);

/**
 * The answers of one question drawn without editors, as the student reads them, below the prompt that
 * the caller draws on the same paper (`PreviewProse`). The page draws them when its editors are not
 * mounted, and the thumbnails draw them small, so a page and its thumbnail look alike. A page passes
 * `withControls`, which keeps the room of its option controls and of the action that adds an option, so
 * the paper is as wide and as tall as it is when the editor mounts.
 */
export function PaperSketch({
  question,
  withControls = false,
}: {
  question: Question;
  withControls?: boolean;
}) {
  const t = useTranslations("Exams");
  const locked = useExamLocked();
  const choice = choiceOf(question.answers);
  // A template that fixes its options takes no added option, so its page keeps no room for the action.
  const addsOption =
    withControls &&
    !locked &&
    Option.isNone(fixedOptions(question.template)) &&
    Option.exists(
      choice,
      (current) => current.options.length < CHOICE_OPTIONS_MAX
    );

  return (
    <>
      {Option.isSome(choice) ? (
        <PaperOptions>
          {Arr.map(choice.value.options, (option, index) => (
            <PaperChoice key={option.id} withControls={withControls}>
              <PaperOption letter={optionLetter(index)}>
                <OptionSketch label={option.label} />
              </PaperOption>
            </PaperChoice>
          ))}
        </PaperOptions>
      ) : null}
      {Option.match(matchOf(question.answers), {
        onNone: () => null,
        onSome: (match) => (
          <div className="grid min-w-0 gap-6 md:grid-cols-2">
            <PartSketch
              adds
              heading={t("match-statements")}
              letterOf={statementNumber}
              parts={match.sources}
              withControls={withControls}
            />
            <PartSketch
              adds
              heading={t("match-answers")}
              letterOf={optionLetter}
              parts={match.targets}
              withControls={withControls}
            />
          </div>
        ),
      })}
      {Option.match(tableOf(question.answers), {
        onNone: () => null,
        onSome: (table) => (
          <TableSketch columns={table.columns} statements={table.statements} />
        ),
      })}
      {Option.isSome(entryOf(question.answers)) ? <PaperLine /> : null}
      {question.template === "essay" ? <PaperLine essay /> : null}
      {addsOption ? <OptionAddRoom /> : null}
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
        className="pointer-events-none w-4/1 origin-top-left scale-25 p-4"
        inert
      >
        <QuestionPaper>
          <PreviewProse article doc={doc} size="page" />
          <PaperSketch question={question} />
        </QuestionPaper>
      </div>
    </div>
  );
}
