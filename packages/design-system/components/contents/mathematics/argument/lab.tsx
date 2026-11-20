import {
  CircleIcon,
  SquareIcon,
  TriangleIcon,
} from "@hugeicons/core-free-icons";
import {
  arrangements,
  changedCard,
  picked,
  startSeats,
  toggle,
} from "@repo/design-system/components/contents/mathematics/argument/chain";
import type {
  ArgumentCard,
  Fallacy,
  Form,
} from "@repo/design-system/components/contents/mathematics/argument/form";
import { readChain } from "@repo/design-system/components/contents/mathematics/argument/form";
import {
  ShapeSchema,
  slotsOf,
} from "@repo/design-system/components/contents/mathematics/argument/layout";
import { PlayArrangements } from "@repo/design-system/components/contents/mathematics/argument/play";
import { ArgumentScene } from "@repo/design-system/components/contents/mathematics/argument/scene";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import {
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { ARGUMENT_COLORS } from "@repo/design-system/lib/material/argument";
import { Array as Arr, Match, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

/** How far the rail and the tray reach from their middle, in metres. */
const REACH = 0.24;

/** The icon of each tab shape, which the toolbar's toggle for that card shows. */
const SHAPE_ICONS = {
  circle: CircleIcon,
  square: SquareIcon,
  triangle: TriangleIcon,
} as const;

/** A slot's own card, or none for a slot the learner fills from the hand. */
function ownCard(slot: ArgumentCard | "open") {
  return slot === "open" ? Option.none() : Option.some(slot);
}

/** A reading the chain cannot give yet, while a slot it needs is empty. */
function Unknown() {
  return <span className="text-muted-foreground">?</span>;
}

/** A yes or no reading of the chain, or a question mark while it cannot be read. */
function Answer({
  no,
  value,
  yes,
}: {
  readonly no: ReactNode;
  readonly value: Option.Option<boolean>;
  readonly yes: ReactNode;
}) {
  return Option.match(value, {
    onNone: () => <Unknown />,
    onSome: (answer) => (answer ? yes : no),
  });
}

/**
 * An argument as a chain of cards on a rail: the first premise, the second
 * and the conclusion lie in three pockets joined by chain links, and the
 * hand of cards waits on a tray beside it. The learner deals a hand card
 * into the first open pocket by pressing it on the table or its shape in the
 * toolbar, and presses it again to take it back. With `showVerdict`, the
 * links lock in brass when the conclusion follows and the lamp round the
 * conclusion lights; a chain built on a fallacy stays open and its broken
 * link swings apart in red, at the step where it fails; and a false card in
 * the chain carries a red seal without breaking the form, so a valid
 * argument with a false premise reads as valid but not sound. The footer
 * names the form, whether the conclusion follows, whether every premise is
 * true, and whether the argument is sound. Without `showVerdict`, as in a
 * question, the links wait in steel and the footer stays away.
 */
export function ArgumentChainLab({
  conclusion,
  description,
  hand,
  labels,
  premises,
  showVerdict = false,
  title,
}: {
  readonly conclusion: ArgumentCard | "open";
  readonly description: NonNullable<ReactNode>;
  readonly hand: readonly [ArgumentCard, ...ArgumentCard[]];
  readonly labels: {
    readonly conclusion: string;
    readonly fallacies: Readonly<Record<Fallacy, ReactNode>>;
    readonly form: ReactNode;
    readonly forms: Readonly<Record<Form, ReactNode>>;
    readonly hand: string;
    readonly no: ReactNode;
    readonly premises: readonly [string, string];
    readonly sound: ReactNode;
    readonly truth: ReactNode;
    readonly unfollowed: ReactNode;
    readonly unlinked: ReactNode;
    readonly valid: ReactNode;
    readonly viewLabel: string;
    readonly yes: ReactNode;
  };
  readonly premises: readonly [ArgumentCard | "open", ArgumentCard | "open"];
  readonly showVerdict?: boolean;
  readonly title: NonNullable<ReactNode>;
}) {
  const fixed = [
    ownCard(premises[0]),
    ownCard(premises[1]),
    ownCard(conclusion),
  ] as const;
  const [seats, setSeats] = useState(() =>
    startSeats(Arr.map(fixed, Option.isNone))
  );
  const reading = readChain(slotsOf(fixed, hand, seats));
  const shown = showVerdict
    ? reading
    : { ...reading, joints: ["pending", "pending"] as const, lit: false };

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.hand}
          gridColumns="2"
          onValueChange={(next: readonly string[]) => {
            Option.map(changedCard(seats, hand.length, next), (card) =>
              setSeats((now) => toggle(now, card))
            );
          }}
          type="multiple"
          value={Arr.map(picked(seats), String)}
          variant="outline"
        >
          {Arr.map(hand, (card, index) => (
            <ToggleGroupItem
              aria-label={card.text}
              key={card.text}
              value={String(index)}
            >
              <HugeIcons
                icon={SHAPE_ICONS[Arr.getUnsafe(ShapeSchema.literals, index)]}
              />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={REACH} setting="studio">
          <PlayArrangements
            list={arrangements(seats, hand.length)}
            onArrange={setSeats}
          />
          <Suspense fallback={null}>
            <ArgumentScene
              fixed={fixed}
              hand={hand}
              joints={shown.joints}
              lit={shown.lit}
              names={[
                labels.premises[0],
                labels.premises[1],
                labels.conclusion,
              ]}
              onToggle={(card) => setSeats((now) => toggle(now, card))}
              seats={seats}
              showVerdict={showVerdict}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      {showVerdict ? (
        <VisualCardFooter>
          <VisualCardFacts>
            <VisualFactTabular
              label={labels.form}
              value={Option.match(reading.verdict, {
                onNone: () => <Unknown />,
                onSome: (verdict) =>
                  Match.value(verdict).pipe(
                    Match.discriminatorsExhaustive("kind")({
                      fallacy: ({ fallacy }) => labels.fallacies[fallacy],
                      unfollowed: () => labels.unfollowed,
                      unlinked: () => labels.unlinked,
                      valid: ({ form }) => labels.forms[form],
                    })
                  ),
              })}
            />
            <VisualFactIndicator
              indicatorColor={Option.getOrUndefined(
                Option.map(reading.valid, (yes) =>
                  yes ? ARGUMENT_COLORS.locked : ARGUMENT_COLORS.broken
                )
              )}
              label={labels.valid}
              value={
                <Answer no={labels.no} value={reading.valid} yes={labels.yes} />
              }
            />
            <VisualFactIndicator
              indicatorColor={Option.getOrUndefined(
                Option.map(reading.premisesTrue, (yes) =>
                  yes ? undefined : ARGUMENT_COLORS.seal
                )
              )}
              label={labels.truth}
              value={
                <Answer
                  no={labels.no}
                  value={reading.premisesTrue}
                  yes={labels.yes}
                />
              }
            />
            <VisualFactTabular
              label={labels.sound}
              value={
                <Answer no={labels.no} value={reading.sound} yes={labels.yes} />
              }
            />
          </VisualCardFacts>
        </VisualCardFooter>
      ) : null}
    </VisualCard>
  );
}
