import { Flag02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";
import type { PlayerQuestionModel } from "@/components/player/model";
import { usePlayer } from "@/components/player/provider";

/**
 * Flags the current question to come back to it, or takes its flag off. The
 * button keeps one name and one width, and says whether the question is
 * flagged through its pressed state, which fills it with the flag color that
 * the navigator's flag mark uses. The question's flag changes at once, so a
 * press never waits for the server.
 */
export function PlayerFlag({
  locked,
  questions,
}: {
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

  return (
    <Button
      aria-keyshortcuts="F"
      aria-pressed={flagged}
      className="aria-pressed:border-warning aria-pressed:bg-warning aria-pressed:text-warning-foreground aria-pressed:hover:bg-warning/90 aria-pressed:hover:text-warning-foreground"
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
