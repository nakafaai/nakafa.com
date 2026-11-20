import { Button } from "@repo/design-system/components/ui/button";
import { Array as Arr, Option } from "effect";
import { useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { LeaderList, LeaderRow } from "@/components/progress/leaders";
import { PaneSection } from "@/components/progress/section";
import { useSetPane } from "@/components/tryout/pane/context";

/** How many learners the board shows until the learner asks for all it holds. */
const FIRST = 5;

/**
 * The set's leaderboard (the owner's notes of 20 Nov): its learners by their best score, the first five
 * until the learner asks for all, then their own row where it is not among them. A set nobody has finished
 * shows none, and neither does a visitor's pane.
 */
export function SetBoard() {
  const tIsland = useTranslations("Island");
  const tCommon = useTranslations("Common");
  const format = useFormatter();
  const { board } = useSetPane();
  const [all, setAll] = useState(false);
  if (Option.isNone(board) || board.value.leaders.length === 0) {
    return null;
  }
  const { leaders, own } = board.value;
  const shown = all ? leaders : Arr.take(leaders, FIRST);
  const ownShown = Arr.some(shown, (leader) => leader.own);

  return (
    <PaneSection
      action={
        leaders.length > FIRST ? (
          <Button
            onClick={() => setAll(!all)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {tCommon(all ? "less" : "all")}
          </Button>
        ) : null
      }
      title={tIsland("leaders-title")}
    >
      <LeaderList>
        {Arr.map(shown, (leader) => (
          <LeaderRow key={leader.id} leader={leader}>
            {format.number(leader.score)}
          </LeaderRow>
        ))}
        {own === null || ownShown ? null : (
          <LeaderRow leader={own}>{format.number(own.score)}</LeaderRow>
        )}
      </LeaderList>
    </PaneSection>
  );
}
