import {
  Atom01Icon,
  Award01Icon,
  CalculatorIcon,
  Compass01Icon,
  Dna01Icon,
  TestTube01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { Badge } from "@repo/backend/confect/island/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useProgress } from "@/components/progress/context";

/** Each badge's icon, the one the badge stands for. */
const ICONS = {
  biology: Dna01Icon,
  chemistry: TestTube01Icon,
  explorer: Compass01Icon,
  fighter: Award01Icon,
  mathematics: CalculatorIcon,
  physics: Atom01Icon,
} satisfies Record<typeof Badge.Type, IconSvgElement>;

/** A badge's medal: bright once earned, quiet while it is still to earn. */
const medalVariants = cva(
  "grid size-12 place-items-center rounded-full ring-1",
  {
    variants: {
      earned: {
        false: "bg-muted text-muted-foreground ring-border",
        true: "bg-amber-400/15 text-amber-600 ring-amber-400/40 dark:text-amber-400",
      },
    },
  }
);

/**
 * The badges an island earns (ADR 0042, D11; the owner's home sketch, 13
 * Nov): every badge, the earned ones bright, and under each badge still to
 * earn what it asks for.
 */
export function BadgesCard() {
  const t = useTranslations("Island");
  const { island } = useProgress();
  const held = Arr.map(island.badges, (earned) => earned.badge);
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("badges-title")}</CardTitle>
        <CardDescription>
          {t("badges-count", {
            earned: held.length,
            total: Badge.literals.length,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Arr.map(Badge.literals, (badge) => (
            <BadgeItem
              badge={badge}
              earned={Arr.contains(held, badge)}
              key={badge}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** One badge: its medal, its name, and what it asks for until it is earned. */
function BadgeItem({
  badge,
  earned,
}: {
  badge: typeof Badge.Type;
  earned: boolean;
}) {
  const t = useTranslations("Island");
  return (
    <li className="flex flex-col items-center gap-1.5 text-center">
      <span className={medalVariants({ earned })}>
        <HugeIcons className="size-6" icon={ICONS[badge]} />
      </span>
      <span className="text-sm font-medium">{t(`badge-${badge}`)}</span>
      {earned ? null : (
        <span className="text-muted-foreground text-xs text-pretty">
          {t(`badge-${badge}-hint`)}
        </span>
      )}
    </li>
  );
}
