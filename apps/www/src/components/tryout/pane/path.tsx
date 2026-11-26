import { Flag02Icon, StarIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import { tierOf } from "@repo/backend/confect/progress/badge";
import { AWARD_RULES } from "@repo/backend/confect/progress/schema";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Medal } from "@repo/design-system/components/ui/medal";
import { Tile, TileIcon } from "@repo/design-system/components/ui/tile";
import { getTileLooks } from "@repo/design-system/lib/look";
import { rowLineVariants } from "@repo/design-system/lib/row";
import { cva } from "class-variance-authority";
import { Array as Arr, Option, Tuple } from "effect";
import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { PaneSection } from "@/components/progress/section";
import { getTryoutSubjectIcons } from "@/components/tryout/catalog/icons";
import { useSetPane } from "@/components/tryout/pane/context";
import type { PartStep } from "@/components/tryout/pane/model";
import { partScore, partStep } from "@/components/tryout/pane/model";
import { TryoutPartInfoDialog } from "@/components/tryout/pane/part";
import { TryoutPageLink } from "@/components/tryout/route/link";
import { TryoutClock } from "@/components/tryout/runtime/countdown";
import {
  useSetTryoutPressIntent,
  useTryoutStartPhase,
} from "@/components/tryout/runtime/start";
import type { TryoutPart } from "@/components/tryout/set/model";
import {
  TryoutPartStartDialog,
  useStartPart,
} from "@/components/tryout/set/part";

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

/** A step's card: the part the attempt resumes at stands out, and a part a press opens lights up under the pointer. */
const cardVariants = cva(
  "flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 text-start",
  {
    variants: {
      dimmed: { false: "", true: "opacity-60" },
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

/**
 * A step's card: a completed part of a finished attempt opens its review, a running part opens where it runs,
 * a completed part of an in-progress attempt or a missed part opens its info dialog (never an empty card page),
 * and an unstarted part of a running attempt asks for confirmation before starting its clock. A set the learner
 * has not started takes the press as its footer's action does. A part with no page of its own, and an unstarted
 * part while another one runs, take no press.
 */
function StepCard({
  children,
  part,
  publicPath,
  step,
}: {
  children: ReactNode;
  part: TryoutPart;
  publicPath: string | undefined;
  step: PartStep;
}) {
  const { view } = useSetPane();
  const attempt = view.actionAttempt ?? null;
  const next = step === "next";
  if (publicPath === undefined) {
    return (
      <div
        className={cardVariants({ link: false, next })}
        data-part-step={step}
      >
        {children}
      </div>
    );
  }
  const opensReview =
    step === "done" && attempt !== null && attempt.status !== "in-progress";
  const opensRunning = attempt?.activeSectionKey === part.sectionKey;
  if (opensReview || opensRunning) {
    return (
      <TryoutPageLink
        attemptId={attempt?.attemptId}
        className={cardVariants({ link: true, next })}
        data-part-step={step}
        preload="intent"
        publicPath={publicPath}
      >
        {children}
      </TryoutPageLink>
    );
  }
  if (step === "done" || step === "missed") {
    return (
      <PartInfoButton next={next} part={part} step={step}>
        {children}
      </PartInfoButton>
    );
  }
  if (attempt?.status !== "in-progress") {
    return (
      <StartPress next={next} part={part} publicPath={publicPath} step={step}>
        {children}
      </StartPress>
    );
  }
  if (attempt.activeSectionKey !== null) {
    return (
      <div
        className={cardVariants({ dimmed: true, link: false, next })}
        data-part-step={step}
      >
        {children}
      </div>
    );
  }
  return (
    <OpenPart
      attemptId={attempt.attemptId}
      next={next}
      part={part}
      publicPath={publicPath}
      step={step}
    >
      {children}
    </OpenPart>
  );
}

/** A finished part while its set still runs, or a missed part: a press opens its info dialog right in the pane. */
function PartInfoButton({
  children,
  next,
  part,
  step,
}: {
  children: ReactNode;
  next: boolean;
  part: TryoutPart;
  step: PartStep;
}) {
  const { view } = useSetPane();
  const [dialogOpen, dialog] = useDisclosure(false);
  const score = partScore(view.actionAttempt ?? null, part.sectionKey);

  return (
    <>
      <button
        className={cardVariants({ link: true, next })}
        data-part-step={step}
        onClick={dialog.open}
        type="button"
      >
        {children}
      </button>
      <TryoutPartInfoDialog
        open={dialogOpen}
        part={part}
        score={score}
        setOpen={(open) => (open ? dialog.open() : dialog.close())}
      />
    </>
  );
}

/** A part of a running attempt not started yet: a press asks for confirmation, then starts it and opens it running. */
function OpenPart({
  attemptId,
  children,
  next,
  part,
  publicPath,
  step,
}: {
  attemptId: Id<"tryoutAttempts">;
  children: ReactNode;
  next: boolean;
  part: TryoutPart;
  publicPath: string;
  step: PartStep;
}) {
  const startPart = useStartPart();
  const busy = useTryoutStartPhase() !== "idle";
  const [dialogOpen, dialog] = useDisclosure(false);

  return (
    <>
      <button
        className={cardVariants({ link: true, next })}
        data-part-step={step}
        inert={busy}
        onClick={dialog.open}
        type="button"
      >
        {children}
      </button>
      <TryoutPartStartDialog
        busy={busy}
        onStart={() =>
          startPart({
            address: Option.some({ attemptId, publicPath }),
            attemptId,
            sectionKey: part.sectionKey,
          })
        }
        open={dialogOpen}
        part={part}
        setOpen={(open) => (open ? dialog.open() : dialog.close())}
      />
    </>
  );
}

/** A part of a set the learner has not started: a press passes this exact part to the page's action. */
function StartPress({
  children,
  next,
  part,
  publicPath,
  step,
}: {
  children: ReactNode;
  next: boolean;
  part: TryoutPart;
  publicPath: string;
  step: PartStep;
}) {
  const setIntent = useSetTryoutPressIntent();
  return (
    <button
      className={cardVariants({ link: true, next })}
      data-part-step={step}
      onClick={() => setIntent({ kind: "part", part, publicPath })}
      type="button"
    >
      {children}
    </button>
  );
}

/**
 * The set as one path (the owner's notes of 20 Nov): a step for each part the learner sits, marked by where the
 * attempt the pane shows stands, each with its score once finished or the Stars it still gives, ending at the set's
 * finish, which shows the medal finishing it counts toward.
 */
export function SetPath() {
  const t = useTranslations("Tryouts");
  const tProgress = useTranslations("Progress");
  const tCommon = useTranslations("Common");
  const format = useFormatter();
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
          const score = partScore(attempt, section.sectionKey);
          const runningHere =
            attempt?.status === "in-progress" &&
            attempt.activeSectionKey === section.sectionKey;
          const waitingForOther =
            attempt?.status === "in-progress" &&
            attempt.activeSectionKey !== null &&
            !runningHere &&
            step !== "done";
          const gives =
            !(runningHere || waitingForOther) &&
            (step === "next" || step === "todo") &&
            !Arr.contains(claims.sections, section.sectionKey);
          const part: TryoutPart = {
            questionCount: section.questionCount,
            sectionKey: section.sectionKey,
            timeLimitSeconds: section.timeLimitSeconds,
            title: section.title,
          };
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
              <StepCard part={part} publicPath={section.publicPath} step={step}>
                <Tile className="size-10" seed={look.seed} shift={look.shift}>
                  <TileIcon icon={look.icon} />
                </Tile>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={rowLineVariants()} title={section.title}>
                    {section.title}
                  </span>
                  <span className={rowLineVariants({ line: "fact" })}>
                    {waitingForOther
                      ? t("part-waiting-label")
                      : t("set-facts", {
                          count: section.questionCount,
                          minutes: section.timeLimitSeconds / 60,
                        })}
                  </span>
                </span>
                {runningHere && attempt.activeSectionExpiresAt !== null ? (
                  <span className="text-primary shrink-0 text-xs font-medium tabular-nums">
                    <TryoutClock expiresAt={attempt.activeSectionExpiresAt} />
                  </span>
                ) : null}
                {Option.match(score, {
                  onNone: () => null,
                  onSome: (value) => (
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {format.number(value.publishedScore)}
                    </span>
                  ),
                })}
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
                {t("medal-name", { name: tProgress("badge-sets") })}
              </span>
            </span>
            {claims.set ? null : <StepGain stars={AWARD_RULES.set.stars} />}
          </div>
        </PathStep>
      </ol>
    </PaneSection>
  );
}
