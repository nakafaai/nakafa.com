import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Tile, TileIcon } from "@repo/design-system/components/ui/tile";
import { getTileLooks } from "@repo/design-system/lib/look";
import { rowLineVariants } from "@repo/design-system/lib/row";
import { Array as Arr, Option, Tuple } from "effect";
import { useTranslations } from "use-intl";
import { PaneSection } from "@/components/progress/section";
import { getTryoutSubjectIcons } from "@/components/tryout/catalog/icons";
import { useSetPane } from "@/components/tryout/pane/context";
import { partPracticeSummary } from "@/components/tryout/pane/model";
import { getTryoutPracticeTarget } from "@/components/tryout/route/path";
import { TargetLink } from "@/lib/routing/link";

/**
 * The set's untimed practice list: every part of the set opens its own practice in one press,
 * showing checked progress when the learner has already practised that part.
 */
export function SetPractice() {
  const t = useTranslations("Tryouts");
  const tCommon = useTranslations("Common");
  const { practice, sections, view } = useSetPane();
  const looks = getTileLooks(
    Arr.map(sections, (section) =>
      Tuple.make(getTryoutSubjectIcons(section.sectionKey), section.sectionKey)
    )
  );
  const entered = view.entrySection?.visibility === "internal-entry";

  return (
    <PaneSection title={entered ? tCommon("questions") : t("parts-title")}>
      <p className="text-muted-foreground text-sm">
        {t("practice-mode-description")}
      </p>
      <ol className="flex flex-col gap-2">
        {Arr.map(Arr.zip(sections, looks), ([section, look]) => {
          const summary = partPracticeSummary(practice, section.sectionKey);
          const target = getTryoutPracticeTarget(
            section.publicPath ?? view.page.set.publicPath
          );
          const done = Option.exists(
            summary,
            (value) =>
              value.questionCount > 0 &&
              value.checkedCount >= value.questionCount
          );
          if (Option.isNone(target)) {
            return null;
          }
          return (
            <li key={section.sectionKey}>
              <TargetLink
                className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex min-w-0 items-center gap-3 rounded-lg p-2 text-start transition-colors ease-out outline-none focus-visible:ring-3"
                target={target.value}
              >
                <Tile className="size-10" seed={look.seed} shift={look.shift}>
                  <TileIcon icon={look.icon} />
                </Tile>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={rowLineVariants()} title={section.title}>
                    {section.title}
                  </span>
                  <span className={rowLineVariants({ line: "fact" })}>
                    {t("practice-part-facts", {
                      count: section.questionCount,
                    })}
                  </span>
                </span>
                {Option.match(summary, {
                  onNone: () => null,
                  onSome: (value) => (
                    <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs font-medium tabular-nums">
                      {done ? (
                        <HugeIcons
                          className="text-success"
                          icon={Tick02Icon}
                          size="sm"
                        />
                      ) : null}
                      {tCommon("count-of", {
                        count: value.checkedCount,
                        total: value.questionCount,
                      })}
                    </span>
                  ),
                })}
              </TargetLink>
            </li>
          );
        })}
      </ol>
    </PaneSection>
  );
}
