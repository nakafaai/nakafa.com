import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import { partLetter } from "@repo/backend/confect/exams/letters";
import {
  Field,
  FieldDescription,
  FieldTitle,
} from "@repo/design-system/components/ui/field";
import { LineWords } from "@repo/design-system/components/ui/line";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import {
  LinesColumn,
  LinesItem,
  LinesProvider,
} from "@/components/player/lines/board";
import { OptionSketch } from "@/components/tenant/exams/sketch";

/** The props of the key of one matching question. */
interface MatchKeyProps {
  /** Whether the teacher may change the key now. */
  readonly editable: boolean;
  /** The match of the question, as the page shows it. */
  readonly match: Extract<Interaction, { kind: "match" }>;
  /** Saves the pairs each time a line is drawn, moved, or taken away. */
  readonly onPair: (
    pairs: readonly { readonly source: string; readonly target: string }[]
  ) => void;
  /** The pairs the page shows, those the teacher drew that wait for every statement included. */
  readonly pairs: readonly {
    readonly source: string;
    readonly target: string;
  }[];
}

/**
 * The key of a matching question: each statement joined by a line to the answer it takes, as a teacher marks the key
 * of a paper, on the same board the canvas and the student's paper draw, small enough for the panel.
 */
export function MatchKey({ editable, match, onPair, pairs }: MatchKeyProps) {
  const t = useTranslations("Exams");

  return (
    <Field>
      <FieldTitle>{t("answer-key")}</FieldTitle>
      <LinesProvider
        disabled={!editable}
        match={match}
        onPairs={onPair}
        pairs={pairs}
        size="key"
        stretch
      >
        <LinesColumn side="sources">
          {Arr.map(match.sources, (source, index) => (
            <LinesItem
              id={source.id}
              key={source.id}
              name={String(index + 1)}
              side="sources"
            >
              <LineWords>
                <OptionSketch label={source.label} />
              </LineWords>
            </LinesItem>
          ))}
        </LinesColumn>
        <LinesColumn side="targets">
          {Arr.map(match.targets, (target, index) => (
            <LinesItem
              id={target.id}
              key={target.id}
              name={partLetter(match.targets, index)}
              side="targets"
            >
              <LineWords>
                <OptionSketch label={target.label} />
              </LineWords>
            </LinesItem>
          ))}
        </LinesColumn>
      </LinesProvider>
      <FieldDescription>{t("pair-hint")}</FieldDescription>
    </Field>
  );
}
