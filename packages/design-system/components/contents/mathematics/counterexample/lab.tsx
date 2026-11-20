import type {
  ClaimEntrySchema,
  TileEntrySchema,
  Verdict,
} from "@repo/design-system/components/contents/mathematics/counterexample/claim";
import {
  caseOf,
  firstTest,
  holds,
  secondTest,
  verdictOf,
  verdictsOf,
} from "@repo/design-system/components/contents/mathematics/counterexample/claim";
import { CounterexampleScene } from "@repo/design-system/components/contents/mathematics/counterexample/scene";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
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
import { COUNTEREXAMPLE_COLORS } from "@repo/design-system/lib/material/counterexample";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useState } from "react";

/** How far the board, its tiles and the card behind them reach from their middle, in metres. */
const REACH = 0.5;

/**
 * Checking a claim case by case, on real tiles. Numbered maple tiles, or
 * tiles with painted shapes, lie on a felt board, and a card behind them
 * states a claim about them: about all of them, about some of them, or "if
 * p, then q". Playing checks the tiles one by one. With `showAnswer`, each
 * checked tile gets a spot of its verdict's colour: a counterexample of
 * "all" or "if" stands up in red, an example of "some" stands up in green,
 * a tile the claim says nothing about darkens, and a stamp on the card says
 * true or false as soon as one tile settles it. For an implication, the
 * tiles are carried into the four cells of a case board, one for each case
 * of p and q, so the front row, where p is false, shows that those tiles
 * can never break it. The learner picks a tile by pressing it, or from the
 * toolbar's list; the footer names it and, with the answer, what it does to
 * the claim. Without `showAnswer`, as in a question that asks for a
 * counterexample, nothing tells which tiles break the claim.
 */
export function CounterexampleGridLab({
  claims,
  description,
  labels,
  showAnswer = false,
  tiles,
  title,
}: {
  readonly claims: readonly [
    typeof ClaimEntrySchema.Type,
    ...(typeof ClaimEntrySchema.Type)[],
  ];
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly claim: ReactNode;
    readonly claims: string;
    readonly false: string;
    readonly none: ReactNode;
    readonly picked: ReactNode;
    readonly tile: string;
    readonly true: string;
    readonly verdicts: Readonly<Record<Verdict, ReactNode>>;
    readonly viewLabel: string;
  };
  readonly showAnswer?: boolean;
  readonly tiles: readonly [
    typeof TileEntrySchema.Type,
    ...(typeof TileEntrySchema.Type)[],
  ];
  readonly title: NonNullable<ReactNode>;
}) {
  const [chosen, setChosen] = useState(0);
  const [picked, setPicked] = useState(Option.none<number>());
  const entry = Arr.get(claims, chosen).pipe(Option.getOrElse(() => claims[0]));
  const claim = entry.claim;
  const shown = useMemo(() => Arr.map(tiles, (each) => each.tile), [tiles]);
  const verdicts = useMemo(
    () => Arr.map(shown, (tile) => verdictOf(claim, tile)),
    [claim, shown]
  );
  const truth = holds(claim, shown);
  const word = (value: boolean) => (value ? labels.true : labels.false);
  const items = Arr.map(tiles, (each, index) => ({
    label: each.name,
    value: index,
  }));
  const held = Option.flatMap(picked, (index) =>
    Option.all({
      entry: Arr.get(tiles, index),
      verdict: Arr.get(verdicts, index),
    })
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        {claims.length > 1 ? (
          <ToggleGroup
            aria-label={labels.claims}
            gridColumns={claims.length > 2 ? "3" : "2"}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirstIndex(
                  claims,
                  (_each, index) => `${index}` === next
                ),
                setChosen
              );
            }}
            type="single"
            value={`${chosen}`}
            variant="outline"
          >
            {Arr.map(claims, (each, index) => (
              <ToggleGroupItem key={each.name} value={`${index}`}>
                {each.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
        <Select
          items={items}
          onValueChange={(next: number | null) =>
            setPicked(Option.fromNullishOr(next))
          }
          value={Option.getOrNull(picked)}
        >
          <SelectTrigger aria-label={labels.tile} className="w-full">
            <SelectValue
              labels={Arr.dedupe(Arr.map(items, (item) => item.label))}
              placeholder={labels.tile}
            />
          </SelectTrigger>
          <SelectContent label={labels.tile}>
            {Arr.map(items, (item) => (
              <SelectItem key={item.value} plain value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={REACH} setting="studio">
          <Suspense fallback={null}>
            <CounterexampleScene
              claim={claim}
              onPick={(index) =>
                setPicked((current) =>
                  Option.contains(current, index)
                    ? Option.none()
                    : Option.some(index)
                )
              }
              picked={picked}
              showAnswer={showAnswer}
              stamp={word(truth)}
              text={entry.text}
              tiles={shown}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {showAnswer ? (
            <VisualFactTabular label={labels.claim} value={word(truth)} />
          ) : null}
          <VisualFactIndicator
            indicatorColor={Option.match(held, {
              onNone: () => undefined,
              onSome: ({ verdict }) =>
                showAnswer
                  ? COUNTEREXAMPLE_COLORS[verdict]
                  : COUNTEREXAMPLE_COLORS.picked,
            })}
            label={labels.picked}
            value={Option.match(held, {
              onNone: () => labels.none,
              onSome: ({ entry: tile }) => tile.name,
            })}
          />
          {showAnswer
            ? Option.match(held, {
                onNone: () => null,
                onSome: ({ entry: tile }) => (
                  <>
                    {Option.match(firstTest(claim), {
                      onNone: () => null,
                      onSome: (test) => (
                        <VisualFactTabular
                          label={test.name}
                          value={word(caseOf(claim, tile.tile).p)}
                        />
                      ),
                    })}
                    <VisualFactTabular
                      label={secondTest(claim).name}
                      value={word(caseOf(claim, tile.tile).q)}
                    />
                  </>
                ),
              })
            : null}
          {showAnswer
            ? Arr.map(verdictsOf(claim), (verdict) => (
                <VisualFactIndicator
                  indicatorColor={COUNTEREXAMPLE_COLORS[verdict]}
                  key={verdict}
                  label={labels.verdicts[verdict]}
                  value={
                    Arr.filter(verdicts, (each) => each === verdict).length
                  }
                />
              ))
            : null}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
