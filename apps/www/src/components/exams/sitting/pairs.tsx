import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";
import { SittingDocument } from "@/components/exams/sitting/document";
import {
  type MatchPart,
  pairedWith,
} from "@/components/exams/sitting/response";

/** The character code of the letter A, which names the first answer. */
const LETTER_A = 65;

/** The letter that names an answer by its place: A for the first, B for the second, and so on. */
const answerLetter = (index: number) => String.fromCharCode(LETTER_A + index);

/**
 * A matching question as a paper lays it out: the answers in one column, each named by its letter, and
 * the statements in the other, each numbered, with the letter the student pairs it with. Choosing a
 * letter that another statement holds moves it to this statement, since each answer pairs one statement.
 */
export function SittingPairs({
  disabled = false,
  labelledBy,
  match,
  onPair,
  pairs,
}: {
  readonly disabled?: boolean;
  /** The id of the heading that names the question. */
  readonly labelledBy: string;
  readonly match: MatchPart;
  /** Saves the pairs once the student pairs one statement. */
  readonly onPair: (
    pairs: readonly { readonly source: string; readonly target: string }[]
  ) => void;
  /** The pairs the paper holds for the question. */
  readonly pairs: readonly {
    readonly source: string;
    readonly target: string;
  }[];
}) {
  const t = useTranslations("Exams");
  const items = Arr.map(match.targets, (target, index) => ({
    label: answerLetter(index),
    value: target.id,
  }));

  return (
    <fieldset
      aria-labelledby={labelledBy}
      className="grid min-w-0 gap-6 md:grid-cols-2"
    >
      <ol className="grid content-start gap-3">
        {Arr.map(match.sources, (source, index) => (
          <li className="grid gap-2" key={source.id}>
            <div className="flex min-w-0 items-start gap-3">
              <span className="font-medium tabular-nums">{index + 1}.</span>
              <SittingDocument
                document={source.label}
                label={match.label}
                size="line"
              />
            </div>
            <Select
              items={items}
              onValueChange={(target) => {
                if (target !== null) {
                  onPair(
                    pairedWith(match.sources, pairs, {
                      source: source.id,
                      target,
                    })
                  );
                }
              }}
              value={Option.getOrNull(
                Option.map(
                  Arr.findFirst(pairs, (pair) => pair.source === source.id),
                  (pair) => pair.target
                )
              )}
            >
              <SelectTrigger
                aria-label={t("pair-statement", { number: index + 1 })}
                className="w-32"
                disabled={disabled}
              >
                <SelectValue placeholder={t("pair-choose")} />
              </SelectTrigger>
              <SelectContent>
                {Arr.map(items, (item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </li>
        ))}
      </ol>
      <ol className="grid content-start gap-3">
        {Arr.map(match.targets, (target, index) => (
          <li className="flex min-w-0 items-start gap-3" key={target.id}>
            <span className="font-medium">{answerLetter(index)}.</span>
            <SittingDocument
              document={target.label}
              label={match.label}
              size="line"
            />
          </li>
        ))}
      </ol>
    </fieldset>
  );
}
