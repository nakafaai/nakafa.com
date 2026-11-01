import { Flag02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cva } from "class-variance-authority";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";
import type { PlayerQuestionModel } from "@/components/player/model";
import { readPosition } from "@/components/player/order";
import { usePlayer } from "@/components/player/provider";

/** A flag button that fills with the flag color, the navigator's flag mark, while its question is flagged. */
const flagButton = cva(
  "aria-pressed:border-warning aria-pressed:bg-warning aria-pressed:text-warning-foreground aria-pressed:hover:bg-warning/90 aria-pressed:hover:text-warning-foreground"
);

/**
 * Flags the current question to come back to it, or takes its flag off, when
 * the player shows one question at a time. The list flags each question on the
 * question itself (`PlayerQuestionFlag`), because the question at its reading
 * line is not always the one the learner reads, so the list shows no flag here.
 * The flag stands beside the footer's centre, out of the row's flow: before the
 * navigator opener below the large breakpoint, and on the centre itself from
 * it, where no opener shows. So the centre's width never depends on the view,
 * the opener stays on the screen's middle, and nothing moves when the view
 * changes. The button keeps one name and one width, its name for a screen
 * reader alone on a phone, and says whether the question is flagged through its
 * pressed state. The question's flag changes at once, so a press never waits
 * for the server. A footer with a `PlayerNote` keeps the flag before the note at every width.
 */
export function PlayerFlag({
  beforeNote = false,
  locked,
  questions,
}: {
  /** Whether the footer's centre holds a note, so the flag stands before it. */
  beforeNote?: boolean;
  /** Flags are read-only because time ran out. */
  locked: boolean;
  questions: readonly PlayerQuestionModel[];
}) {
  const t = useTranslations("Player");
  const current = usePlayer((state) => state.current);
  const question = Arr.findFirst(
    questions,
    (candidate) => candidate.key === current
  );
  const flagged = Option.exists(question, (candidate) => candidate.flagged);
  const single = usePlayer((state) => state.mode === "single");

  if (!single) {
    return null;
  }

  return (
    <Button
      aria-keyshortcuts="F"
      aria-pressed={flagged}
      className={flagButton({
        className: beforeNote
          ? "absolute end-full top-1/2 me-2 -translate-y-1/2"
          : "absolute end-full top-1/2 me-2 -translate-y-1/2 lg:start-1/2 lg:end-auto lg:me-0 lg:-translate-x-1/2 lg:rtl:translate-x-1/2",
      })}
      disabled={locked || Option.isNone(question)}
      onClick={() => Option.map(question, (candidate) => candidate.flag())}
      type="button"
      variant="outline"
    >
      <HugeIcons icon={Flag02Icon} />
      <span className="max-sm:sr-only">{t("flag")}</span>
    </Button>
  );
}

/**
 * The flag of one question in the list, at the top end of the question, so the
 * learner flags exactly the question they read. One question at a time flags
 * from the footer instead (`PlayerFlag`).
 */
export function PlayerQuestionFlag({
  flagged,
  locked,
  onFlag,
  questionKey,
}: {
  readonly flagged: boolean;
  /** Flags are read-only because time ran out. */
  readonly locked: boolean;
  readonly onFlag: () => void;
  readonly questionKey: string;
}) {
  const t = useTranslations("Player");
  const list = usePlayer((state) => state.mode === "list");
  const number = usePlayer((state) => readPosition(state.keys, questionKey));

  if (!list) {
    return null;
  }

  return (
    <Button
      aria-label={t("flag-question", { number })}
      aria-pressed={flagged}
      className={flagButton({ className: "absolute end-0 top-0" })}
      disabled={locked}
      onClick={onFlag}
      type="button"
      variant="outline"
    >
      <HugeIcons icon={Flag02Icon} />
      {t("flag")}
    </Button>
  );
}
