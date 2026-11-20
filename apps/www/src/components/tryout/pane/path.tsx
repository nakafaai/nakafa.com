import {
  ArrowRight01Icon,
  Flag02Icon,
  StarIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { tierOf } from "@repo/backend/confect/island/badge";
import { AWARD_RULES } from "@repo/backend/confect/island/schema";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Medal } from "@repo/design-system/components/ui/medal";
import { Tile, TileIcon } from "@repo/design-system/components/ui/tile";
import { getTileLooks } from "@repo/design-system/lib/look";
import { rowLineVariants } from "@repo/design-system/lib/row";
import { cva } from "class-variance-authority";
import { Array as Arr, Tuple } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { PaneSection } from "@/components/progress/section";
import { getTryoutSubjectIcons } from "@/components/tryout/catalog/icons";
import { useSetPane } from "@/components/tryout/pane/context";
import { type PartStep, partStep } from "@/components/tryout/pane/model";
import { TryoutPageLink } from "@/components/tryout/route/link";

/** A step's marker on the path: a part's number or tick in a circle, the finish's flag in a rounded square. */
const nodeVariants = cva(
  "relative z-10 mt-2 flex size-6 shrink-0 items-center justify-center text-xs font-medium tabular-nums",
  {
    variants: {
      finish: { false: "rounded-full", true: "rounded-md" },
      step: {
        done: "bg-success text-success-foreground",
        missed:
          "border-muted-foreground/50 text-muted-foreground bg-background border border-dashed",
        next: "border-foreground text-foreground bg-background border-2",
        todo: "text-muted-foreground bg-background border",
      },
    },
  }
);

/** The line from a step down to the next one, green once the step is done. */
const lineVariants = cva(
  "absolute start-2.75 top-8 -bottom-2 w-0.5 rounded-full",
  { variants: { done: { false: "bg-border", true: "bg-success/60" } } }
);

/** A step's card: the part the attempt resumes at stands out, and a part with a page lights up under the pointer. */
const cardVariants = cva(
  "flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2",
  {
    variants: {
      link: {
        false: "",
        true: "hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring transition-colors ease-out outline-none focus-visible:ring-3",
      },
      next: { false: "", true: "bg-accent text-accent-foreground" },
    },
  }
);

/** The Stars a step still gives. */
function StepGain({ stars }: { stars: number }) {
  return (
    <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs tabular-nums">
      <HugeIcons
        className="fill-pop-yellow text-pop-yellow"
        icon={StarIcon}
        size="sm"
      />
      +{stars}
    </span>
  );
}

/** One step of the path: its marker, the line to the next step, and its card. */
function PathStep({
  children,
  line,
  node,
}: {
  children: ReactNode;
  /** Whether a line leads to the next step, and whether it is done; the last step has none. */
  line?: boolean;
  node: ReactNode;
}) {
  return (
    <li className="relative flex gap-3">
      {node}
      {line === undefined ? null : (
        <span aria-hidden="true" className={lineVariants({ done: line })} />
      )}
      {children}
    </li>
  );
}

/** A step's card: a link to the part's page where it has one, so its result or its questions are one press away. */
function StepCard({
  children,
  publicPath,
  step,
}: {
  children: ReactNode;
  publicPath: string | undefined;
  step: PartStep;
}) {
  const { view } = useSetPane();
  const next = step === "next";
  if (publicPath === undefined) {
    return (
      <div className={cardVariants({ link: false, next })}>{children}</div>
    );
  }
  return (
    <TryoutPageLink
      attemptId={view.actionAttempt?.attemptId}
      className={cardVariants({ link: true, next })}
      preload="intent"
      publicPath={publicPath}
    >
      {children}
      <HugeIcons className="shrink-0" icon={ArrowRight01Icon} />
    </TryoutPageLink>
  );
}

/**
 * The set as one path (the owner's notes of 20 Nov): a step for each part the learner sits, marked by where the
 * attempt the pane shows stands, each with the Stars it still gives, ending at the set's finish, which shows the
 * medal finishing it counts toward.
 */
export function SetPath() {
  const t = useTranslations("Tryouts");
  const tIsland = useTranslations("Island");
  const tCommon = useTranslations("Common");
  const { claims, sections, tally, view } = useSetPane();
  const attempt = view.actionAttempt ?? null;
  const looks = getTileLooks(
    Arr.map(sections, (section) =>
      Tuple.make(getTryoutSubjectIcons(section.sectionKey), section.sectionKey)
    )
  );
  const entered = view.entrySection?.visibility === "internal-entry";
  // The medal the learner holds once this set counts, in colour even before the first, so they see what they win.
  const tier = Math.max(1, tierOf(tally.sets + (claims.set ? 0 : 1)));

  return (
    <PaneSection title={entered ? tCommon("questions") : t("parts-title")}>
      <ol className="flex flex-col gap-2">
        {Arr.map(Arr.zip(sections, looks), ([section, look], index) => {
          const step = partStep(attempt, section.sectionKey);
          const gives =
            (step === "next" || step === "todo") &&
            !Arr.contains(claims.sections, section.sectionKey);
          return (
            <PathStep
              key={section.sectionKey}
              line={step === "done"}
              node={
                <span className={nodeVariants({ finish: false, step })}>
                  {step === "done" ? (
                    <HugeIcons icon={Tick02Icon} size="sm" />
                  ) : (
                    index + 1
                  )}
                </span>
              }
            >
              <StepCard publicPath={section.publicPath} step={step}>
                <Tile className="size-10" seed={look.seed} shift={look.shift}>
                  <TileIcon icon={look.icon} />
                </Tile>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={rowLineVariants()} title={section.title}>
                    {section.title}
                  </span>
                  <span className={rowLineVariants({ line: "fact" })}>
                    {t("set-facts", {
                      count: section.questionCount,
                      minutes: section.timeLimitSeconds / 60,
                    })}
                  </span>
                </span>
                {step === "missed" ? (
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {t("part-missed")}
                  </span>
                ) : null}
                {gives ? <StepGain stars={AWARD_RULES.section.stars} /> : null}
              </StepCard>
            </PathStep>
          );
        })}
        <PathStep
          node={
            <span
              className={nodeVariants({
                finish: true,
                step: attempt?.status === "completed" ? "done" : "todo",
              })}
            >
              <HugeIcons icon={Flag02Icon} size="sm" />
            </span>
          }
        >
          <div className={cardVariants({ link: false, next: false })}>
            <Medal className="w-10 shrink-0" name="sets" tier={tier} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={rowLineVariants()}>{t("set-done")}</span>
              <span className={rowLineVariants({ line: "fact" })}>
                {t("medal-name", { name: tIsland("badge-sets") })}
              </span>
            </span>
            {claims.set ? null : <StepGain stars={AWARD_RULES.set.stars} />}
          </div>
        </PathStep>
      </ol>
    </PaneSection>
  );
}
