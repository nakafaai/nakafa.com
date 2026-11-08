import { ArrowRight02Icon, MortarboardIcon } from "@hugeicons/core-free-icons";
import { AvatarGroup } from "@repo/design-system/components/ui/avatar";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Nina } from "@repo/design-system/components/ui/nina";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { DEMO_COHORTS } from "@/components/marketing/school/cast";
import { SchoolFeatureText } from "@/components/marketing/school/row";
import { stepVariants } from "@/components/marketing/school/step";
import { FeatureCard, FeatureRow } from "@/components/marketing/shared/feature";

/** Each cohort that the year's end moves: its grade, the grade it moves to (none for the final year), and its size. */
const MOVES = [
  { from: 10, size: 92, step: 1, to: 11 },
  { from: 11, size: 88, step: 2, to: 12 },
  { from: 12, size: 85, step: 3, to: null },
] as const;

/**
 * The graduation row: the end of one school year as the School closes it, each
 * cohort moving up a grade beside its faces and its size, and the final year
 * graduating.
 */
export function SchoolGraduation() {
  const t = useTranslations("SchoolSite");
  const tSubject = useTranslations("Subject");

  return (
    <FeatureRow id="graduation">
      <SchoolFeatureText feature="graduation">
        <Nina act="graduating" label="" size={88} whole />
      </SchoolFeatureText>
      <FeatureCard>
        <p className="flex min-w-0 items-center gap-2 border-b pb-4 font-medium">
          <HugeIcons icon={MortarboardIcon} />
          <span className="truncate">
            {t("demo-graduation-year", { year: "2026/2027" })}
          </span>
        </p>
        <ol className="grid gap-4">
          {Arr.map(Arr.zip(MOVES, DEMO_COHORTS), ([move, faces]) => (
            <li
              className={stepVariants({
                className: "flex flex-wrap items-center gap-3",
                step: move.step,
              })}
              key={move.from}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <span>{tSubject("grade", { grade: move.from })}</span>
                <HugeIcons
                  className="text-muted-foreground"
                  icon={ArrowRight02Icon}
                />
                <span className="font-medium">
                  {move.to === null
                    ? t("demo-graduation-graduated")
                    : tSubject("grade", { grade: move.to })}
                </span>
              </span>
              <AvatarGroup>
                {Arr.map(faces, (mascot) => (
                  <PersonAvatar key={mascot.animal} mascot={mascot} size="sm" />
                ))}
              </AvatarGroup>
              <span className="text-muted-foreground w-24 text-right text-sm tabular-nums">
                {t("demo-graduation-students", { count: move.size })}
              </span>
            </li>
          ))}
        </ol>
      </FeatureCard>
    </FeatureRow>
  );
}
