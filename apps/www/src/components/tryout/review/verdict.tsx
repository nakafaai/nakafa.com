import {
  Cancel01Icon,
  HourglassIcon,
  MinusSignIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "use-intl";
import type { PlayerVerdict } from "@/components/player/model";

/** How each verdict reads on its badge: the colors and marks of the result's seats. */
const VERDICT_BADGE = {
  correct: { icon: Tick02Icon, variant: "success" },
  incorrect: { icon: Cancel01Icon, variant: "destructive" },
  partial: { icon: MinusSignIcon, variant: "warning" },
  pending: { icon: HourglassIcon, variant: "muted-outline" },
  unanswered: { icon: null, variant: "outline" },
} as const;

/**
 * Says how a reviewed question went, in its head: correct, wrong, partly correct, waiting for its grade, or
 * unanswered, with the mark the result's seat carries. A question whose grade the reader may not see says
 * nothing.
 */
export function TryoutVerdictBadge({ verdict }: { verdict: PlayerVerdict }) {
  const t = useTranslations("Tryouts");
  if (verdict === "answered") {
    return null;
  }
  const { icon, variant } = VERDICT_BADGE[verdict];

  return (
    <Badge variant={variant}>
      {icon === null ? null : <HugeIcons icon={icon} />}
      {t("verdict", { state: verdict })}
    </Badge>
  );
}
