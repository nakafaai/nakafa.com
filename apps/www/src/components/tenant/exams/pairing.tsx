import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import {
  FieldDescription,
  FieldTitle,
} from "@repo/design-system/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, Option } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { pairedWith } from "@/components/exams/sitting/response";
import { optionLetter } from "@/components/tenant/exams/answer";
import { keyPairs } from "@/components/tenant/exams/match";

/** The props of the key of one matching question. */
interface MatchKeyProps {
  /** Whether the teacher may change the key now. */
  readonly editable: boolean;
  /** The key the page shows, whose pairs the selects start from. */
  readonly keyed: readonly InteractionKey[] | null;
  /** The match of the question, as the page shows it. */
  readonly match: Extract<Interaction, { kind: "match" }>;
  /** The number of the question, which names each select for assistive technology. */
  readonly number: number;
  /** Saves the pairs once they pair every statement. */
  readonly onPair: (
    pairs: readonly { readonly source: string; readonly target: string }[]
  ) => void;
}

/**
 * The key of a matching question: for each statement, the letter of the answer it takes, as a teacher
 * writes the key of a paper. Choosing a letter that another statement holds moves it here, since each
 * answer pairs one statement. The key saves once every statement is paired, and until then the pairs
 * the teacher chose wait on screen.
 */
export function MatchKey({
  editable,
  keyed,
  match,
  number,
  onPair,
}: MatchKeyProps) {
  const t = useTranslations("Exams");
  // The pairs the teacher chose that do not pair every statement yet, which stand for the key until they do.
  const [draft, setDraft] = useState<
    readonly { readonly source: string; readonly target: string }[] | null
  >(null);
  // Only the pairs of parts the match still holds count, since a part the teacher removed pairs nothing.
  const pairs = Arr.filter(
    draft ?? keyPairs(keyed),
    (item) =>
      Arr.some(match.sources, (part) => part.id === item.source) &&
      Arr.some(match.targets, (part) => part.id === item.target)
  );
  const items = Arr.map(match.targets, (target, index) => ({
    label: optionLetter(index),
    value: target.id,
  }));

  /** Pairs one statement with one answer, and saves the pairs once they pair every statement. */
  const pair = (source: string, target: string) => {
    const next = pairedWith(match.sources, pairs, { source, target });
    if (next.length === match.sources.length) {
      setDraft(null);
      onPair(next);
      return;
    }
    setDraft(next);
  };

  return (
    <div className="grid gap-2">
      <FieldTitle>{t("answer-key")}</FieldTitle>
      <ol className="grid gap-2">
        {Arr.map(match.sources, (source, index) => (
          <li className="flex items-center justify-between gap-4" key={source.id}>
            <span className="text-sm tabular-nums">
              {t("statement-number", { name: index + 1 })}
            </span>
            <Select
              items={items}
              onValueChange={(target) => {
                if (target !== null) {
                  pair(source.id, target);
                }
              }}
              value={Option.getOrNull(
                Option.map(
                  Arr.findFirst(pairs, (item) => item.source === source.id),
                  (item) => item.target
                )
              )}
            >
              <SelectTrigger
                aria-label={t("pair-of", { name: index + 1, number })}
                className="w-24"
                disabled={!editable}
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
      <FieldDescription>{t("pair-hint")}</FieldDescription>
    </div>
  );
}
