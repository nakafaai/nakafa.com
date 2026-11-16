import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useProgress } from "@/components/progress/context";

/** A row of the leaderboard, marked when it is the viewer's own. */
const rowVariants = cva(
  "flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm",
  { variants: { own: { false: "", true: "bg-muted font-medium" } } }
);

/**
 * The global leaderboard (ADR 0047, D27): the learners with the most Stars,
 * most first, each with their place, mascot, first name, level and Stars, the
 * viewer's own row marked.
 */
export function LeadersCard() {
  const t = useTranslations("Island");
  const { leaders } = useProgress();
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t("leaders-title")}</CardTitle>
        <CardDescription>{t("leaders-description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {leaders.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("leaders-empty")}</p>
        ) : (
          <ol className="flex flex-col gap-1">
            {Arr.map(leaders, (leader) => (
              <li
                className={rowVariants({ own: leader.own })}
                key={leader.place}
              >
                <span className="text-muted-foreground w-5 text-right tabular-nums">
                  {leader.place}
                </span>
                <PersonAvatar className="size-7" mascot={leader.mascot} />
                <span className="min-w-0 flex-1 truncate">
                  {leader.own ? t("you", { name: leader.name }) : leader.name}
                </span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {t("level", { level: leader.level })}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
