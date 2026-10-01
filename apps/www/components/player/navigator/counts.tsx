"use client";

import { Flag01Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { NumberFormat } from "@repo/design-system/components/ui/number-flow";
import { useTranslations } from "next-intl";
import { usePlayer } from "@/components/player/context";

/** Answered, flagged, and empty totals, styled like the cells they count. */
export function PlayerCounts() {
  const t = useTranslations("Player");
  const questions = usePlayer((session) => session.state.questions);
  const answered = questions.filter((question) => question.answered).length;
  const flagged = questions.filter((question) => question.flagged).length;
  return (
    <ul className="flex flex-wrap gap-2">
      <li>
        <Badge variant="default">
          {t("answered")}
          <NumberFormat className="font-mono tabular-nums" value={answered} />
        </Badge>
      </li>
      <li>
        <Badge variant="secondary">
          <HugeIcons icon={Flag01Icon} />
          {t("flagged")}
          <NumberFormat className="font-mono tabular-nums" value={flagged} />
        </Badge>
      </li>
      <li>
        <Badge variant="outline">
          {t("empty")}
          <NumberFormat
            className="font-mono tabular-nums"
            value={questions.length - answered}
          />
        </Badge>
      </li>
    </ul>
  );
}
