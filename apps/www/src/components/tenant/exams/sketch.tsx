import { QueryResult, useQuery } from "@confect/react";
import { AddToListIcon, ListPlusIcon } from "@hugeicons/core-free-icons";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { partDirection, partLetter } from "@repo/backend/confect/exams/letters";
import {
  CHOICE_OPTIONS_MAX,
  CHOICE_OPTIONS_MIN,
  fixedOptions,
} from "@repo/backend/confect/exams/question";
import { REASON_ID } from "@repo/backend/confect/exams/scoring";
import {
  editorContent,
  editorDocument,
  editorPlaceholder,
} from "@repo/design-system/components/editor/frame";
import {
  LineMark,
  LineWords,
  MarkedLine,
} from "@repo/design-system/components/ui/line";
import { Node } from "@tiptap/pm/model";
import { cn } from "cn";
import { Array as Arr, Function as Fn, Option } from "effect";
import { useMemo } from "react";
import { useTranslations } from "use-intl";
import { DrawnDocument } from "@/components/assessment/drawn";
import {
  addressesOf,
  SittingPictures,
} from "@/components/exams/sitting/pictures";
import { ChoiceGroup } from "@/components/exams/sitting/reason";
import {
  LinesColumn,
  LinesItem,
  LinesProvider,
} from "@/components/player/lines/board";
import { ChoiceTable } from "@/components/player/table";
import {
  type Choice,
  isChoice,
  type OptionLabel,
} from "@/components/tenant/exams/answer";
import { keyPairs, matchOf } from "@/components/tenant/exams/match";
import type { Question } from "@/components/tenant/exams/optimistic";
import { useExam, useExamLocked } from "@/components/tenant/exams/provider";
import { choiceTitle } from "@/components/tenant/exams/reason";
import {
  PaperField,
  PaperOption,
  PaperOptions,
  PaperPairs,
  PartAdd,
} from "@/components/tenant/exams/sheet";
import { tableOf } from "@/components/tenant/exams/table";
import { assessmentSchema } from "@/lib/editor/assessment";
import { assetIdsOf } from "@/lib/editor/pictures";

/** The addresses of the images a drawn text holds, in one read, by image ID. */
export function useDrawnPictures(doc: Node) {
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

/** The label of one option drawn without an editor, at the size an option's editor takes. */
export function OptionSketch({ label }: { label: OptionLabel }) {
  const doc = useMemo(() => Node.fromJSON(assessmentSchema, label), [label]);
  const urls = useDrawnPictures(doc);

  return (
    <div className={editorContent({ size: "line" })}>
      <SittingPictures value={urls}>
        <DrawnDocument
          className={cn(
            editorPlaceholder(),
            editorDocument({ size: "line", text: "article" })
          )}
          doc={doc}
          paragraphs={false}
        />
      </SittingPictures>
    </div>
  );
}

/**
 * The room a page with controls keeps for a part's remove control, which its live row draws in the same band, so
 * the words wrap alike before and after the editors mount.
 */
function RemoveRoom({ kept }: { readonly kept: boolean }) {
  return kept ? <LineMark aria-hidden /> : null;
}

/**
 * A true or false table drawn without editors, as its live table draws it: the statements' heading and each
 * column's header, then each numbered statement with an empty mark under every column. A page with controls keeps
 * the rooms of each statement's remove control and of the action that adds one.
 */
function TableSketch({
  adds,
  kept,
  table,
}: {
  /** Whether the page keeps the room of the action that adds a statement. */
  readonly adds: boolean;
  /** Whether the page keeps the room of each part's remove control. */
  readonly kept: boolean;
  readonly table: Extract<Interaction, { kind: "matrix" }>;
}) {
  const t = useTranslations("Exams");

  return (
    <div className="grid min-w-0 gap-3">
      <ChoiceTable
        columns={Arr.map(table.columns, (column) => ({
          id: column.id,
          label: <OptionSketch label={column.label} />,
        }))}
        disabled
        label={table.label}
        statementLabel={t("statement-placeholder")}
        statements={Arr.map(table.statements, (statement) => ({
          id: statement.id,
          label: (
            <MarkedLine tone="bare">
              <LineWords>
                <OptionSketch label={statement.label} />
              </LineWords>
              <RemoveRoom
                kept={kept && table.statements.length > CHOICE_OPTIONS_MIN}
              />
            </MarkedLine>
          ),
          marked: undefined,
        }))}
      />
      {adds && table.statements.length < CHOICE_OPTIONS_MAX ? (
        <PartAdd icon={ListPlusIcon} label={t("statement-add")} />
      ) : null}
    </div>
  );
}

/**
 * A matching drawn without editors, as its live board draws it: each part on its outlined row with its dot, and the
 * key's lines between them. A page with controls keeps the rooms of each part's remove control and of the action
 * that adds one.
 */
function MatchSketch({
  adds,
  kept,
  match,
  pairs,
}: {
  /** Whether the page keeps the room of the action that adds a part. */
  readonly adds: boolean;
  /** Whether the page keeps the room of each part's remove control. */
  readonly kept: boolean;
  readonly match: Extract<Interaction, { kind: "match" }>;
  readonly pairs: ReturnType<typeof keyPairs>;
}) {
  const t = useTranslations("Exams");

  return (
    <PaperPairs>
      <LinesProvider
        disabled
        match={match}
        onPairs={Fn.constVoid}
        pairs={pairs}
        size="paper"
        stretch={false}
      >
        {Arr.map(["sources", "targets"] as const, (side) => (
          <LinesColumn
            footer={
              adds && match[side].length < CHOICE_OPTIONS_MAX ? (
                <PartAdd
                  icon={side === "sources" ? ListPlusIcon : AddToListIcon}
                  label={t(
                    side === "sources" ? "statement-add" : "match-answer-add"
                  )}
                />
              ) : null
            }
            key={side}
            side={side}
          >
            {Arr.map(match[side], (part, index) => (
              <LinesItem
                id={part.id}
                key={part.id}
                name={
                  side === "sources"
                    ? String(index + 1)
                    : partLetter(match.targets, index)
                }
                side={side}
              >
                <LineWords>
                  <OptionSketch label={part.label} />
                </LineWords>
                <RemoveRoom
                  kept={kept && match[side].length > CHOICE_OPTIONS_MIN}
                />
              </LinesItem>
            ))}
          </LinesColumn>
        ))}
      </LinesProvider>
    </PaperPairs>
  );
}

/**
 * The answers of one question drawn without editors, as the student reads them, below the prompt that
 * the caller draws on the same paper (`PreviewProse`). The page draws them when its editors are not
 * mounted, and the thumbnails draw them small, so a page and its thumbnail look alike. A page passes
 * `withControls`, which keeps the rooms of the remove controls and of the actions that add a part, so the paper is
 * as tall as it is when the editor mounts and its words wrap alike.
 */
export function PaperSketch({
  question,
  withControls = false,
}: {
  question: Question;
  withControls?: boolean;
}) {
  const locked = useExamLocked();
  // A template that fixes its options neither adds nor removes one, so its page keeps no room for either.
  const fixed = Option.isSome(fixedOptions(question.template));
  const adds = withControls && !locked;

  return (
    <>
      {Arr.map(Arr.filter(question.answers, isChoice), (choice) => (
        <ChoiceSketch
          adds={adds && !fixed}
          choice={choice}
          kept={withControls && !fixed}
          key={choice.id}
          template={question.template}
        />
      ))}
      {Option.match(matchOf(question.answers), {
        onNone: () => null,
        onSome: (match) => (
          <MatchSketch
            adds={adds}
            kept={withControls}
            match={match}
            pairs={keyPairs(question.key)}
          />
        ),
      })}
      {Option.match(tableOf(question.answers), {
        onNone: () => null,
        onSome: (table) => (
          <TableSketch adds={adds} kept={withControls} table={table} />
        ),
      })}
      <PaperField answers={question.answers} />
    </>
  );
}

/** One choice of a page drawn without its editors, a reason under its name, as the page draws it with them. */
function ChoiceSketch({
  adds,
  choice,
  kept,
  template,
}: {
  /** Whether the page keeps the room of the action that adds an option. */
  readonly adds: boolean;
  readonly choice: Choice;
  /** Whether the page keeps the room of each option's remove control. */
  readonly kept: boolean;
  /** The question's template, which names its choices when it holds two. */
  readonly template: Question["template"];
}) {
  const t = useTranslations("Exams");
  const reason = choice.id === REASON_ID;

  return (
    <>
      <ChoiceGroup title={choiceTitle(template, choice.id)}>
        <PaperOptions dir={partDirection(choice.options)}>
          {Arr.map(choice.options, (option, index) => (
            <PaperOption
              key={option.id}
              letter={partLetter(choice.options, index)}
              multiple={choice.maxChoices !== 1}
            >
              <LineWords>
                <OptionSketch label={option.label} />
              </LineWords>
              <RemoveRoom
                kept={kept && choice.options.length > CHOICE_OPTIONS_MIN}
              />
            </PaperOption>
          ))}
        </PaperOptions>
      </ChoiceGroup>
      {adds && choice.options.length < CHOICE_OPTIONS_MAX ? (
        <PartAdd
          icon={ListPlusIcon}
          label={t(reason ? "reason-add" : "option-add")}
        />
      ) : null}
    </>
  );
}
