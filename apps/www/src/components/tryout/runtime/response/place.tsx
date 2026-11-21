import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { QuestionResponse } from "@repo/backend/confect/assessment/parts";
import type { ExamResponse } from "@repo/backend/confect/assessment/response";
import {
  NO_RESPONSE,
  TEXT_RESPONSE_MAX,
  typedText,
} from "@repo/backend/confect/assessment/response";
import { Input } from "@repo/design-system/components/ui/input";
import { Array as Arr, Option } from "effect";
import type { AssessmentPlace } from "@/components/assessment/interaction";
import { useSittingTyping } from "@/components/exams/sitting/typing";
import { entryResponse } from "@/components/tryout/runtime/response/entry";
import { TryoutResponseFields } from "@/components/tryout/runtime/response/fields";
import { partOf } from "@/components/tryout/runtime/response/parts";

/** An interaction a line of text can hold: a word, a number with its unit, or a formula. */
type InlineEntry = Extract<
  Interaction,
  { readonly kind: "mathEntry" | "numericEntry" | "textEntry" }
>;

/** Whether a line of text can hold an interaction's field. */
const isInlineEntry = (interaction: Interaction): interaction is InlineEntry =>
  interaction.kind === "textEntry" ||
  interaction.kind === "numericEntry" ||
  interaction.kind === "mathEntry";

/** The parts of a question of several as the learner answers them, and the save of one part. */
interface TryoutPartsValue {
  readonly id: string;
  readonly interactions: readonly Interaction[];
  readonly locked: boolean;
  readonly onPart: (interaction: string, response: ExamResponse | null) => void;
  readonly response: QuestionResponse | null;
}

/**
 * Draws the field of each part of a question of several where its prompt puts it, as the paper of an exam task
 * leaves room for each part's answer (`AssessmentDocument`'s `place`). A place that names no part of the question
 * draws nothing.
 */
export function placeTryoutParts(value: TryoutPartsValue) {
  return (place: AssessmentPlace) =>
    Option.match(
      Arr.findFirst(
        value.interactions,
        (interaction) => interaction.id === place.interaction
      ),
      {
        onNone: () => null,
        onSome: (interaction) => (
          <TryoutPartField
            inline={place.inline}
            interaction={interaction}
            value={value}
          />
        ),
      }
    );
}

/**
 * The field of one part at its place, named by the part's label: inside a line of text, a word, a number or a
 * formula typed in the line (`TryoutInlineEntry`), and as a block of its own, the field the question would draw
 * below its prompt (`TryoutResponseFields`). A try-out sets no other kind in a line, so any other draws nothing.
 */
function TryoutPartField({
  inline,
  interaction,
  value,
}: {
  readonly inline: boolean;
  readonly interaction: Interaction;
  readonly value: TryoutPartsValue;
}) {
  const id = `${value.id}-${interaction.id}`;
  const response = partOf(value.response, interaction.id);
  const onChange = (next: ExamResponse | null) =>
    value.onPart(interaction.id, next);
  if (!inline) {
    return (
      <div className="my-4 first:mt-0 last:mb-0">
        <TryoutResponseFields
          value={{
            id,
            interaction,
            label: interaction.label,
            locked: value.locked,
            onChange,
            response,
          }}
        />
      </div>
    );
  }
  return isInlineEntry(interaction) ? (
    <TryoutInlineEntry
      entry={interaction}
      locked={value.locked}
      onChange={onChange}
      response={response}
    />
  ) : null;
}

/**
 * A word, a number with its unit, or a formula, typed inside the line of text that holds it, as a gap of a paper
 * leaves room for it. It saves as School's paper field does (`useSittingTyping`), never corrects, capitalizes or
 * marks the spelling of what the learner types, and shows the part's label until the learner types.
 */
function TryoutInlineEntry({
  entry,
  locked,
  onChange,
  response,
}: {
  readonly entry: InlineEntry;
  readonly locked: boolean;
  readonly onChange: (response: ExamResponse | null) => void;
  readonly response: ExamResponse | null;
}) {
  const text = typedText(response ?? NO_RESPONSE);
  const { flush, line, write } = useSittingTyping({
    onType: (typed) => onChange(entryResponse(typed)),
    saved: text,
  });

  return (
    <span className="mx-1 inline-flex items-center gap-2 align-middle">
      <Input
        aria-label={entry.label}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        className="h-8 w-36"
        defaultValue={text}
        // A number and a formula read left to right whatever language the question is in.
        dir={entry.kind === "textEntry" ? "auto" : "ltr"}
        disabled={locked}
        inputMode={entry.kind === "numericEntry" ? "decimal" : "text"}
        maxLength={TEXT_RESPONSE_MAX}
        name={entry.id}
        onBlur={flush}
        onChange={(event) => write(event.currentTarget.value)}
        placeholder={entry.label}
        ref={line}
        spellCheck={false}
      />
      {entry.kind === "numericEntry" && entry.unit !== undefined ? (
        <span>{entry.unit}</span>
      ) : null}
    </span>
  );
}
