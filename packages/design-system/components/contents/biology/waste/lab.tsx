import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import { poseAt } from "@repo/design-system/components/contents/biology/waste/pose";
import type {
  Place,
  Waste,
} from "@repo/design-system/components/contents/biology/waste/route";
import {
  durationOf,
  placeOf,
  routeOf,
  slotOf,
  throughAutoclave,
} from "@repo/design-system/components/contents/biology/waste/route";
import { WasteScene } from "@repo/design-system/components/contents/biology/waste/scene";
import {
  celsiusAt,
  gaugePressure,
  STERILISE,
} from "@repo/design-system/components/contents/biology/waste/steam";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
import {
  UNIT,
  useQuantity,
} from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
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
  VisualFact,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useCallback, useMemo, useState } from "react";

/**
 * Interactive school laboratory waste station. Picking an item on the tray
 * carries it to its safe disposal place (sink, chemical waste bottle, sharps
 * bin, broken glass box, or biohazard autoclave bag) and animates pouring or
 * steam sterilisation at 121 °C.
 */
export function WasteSortLab({
  description,
  items,
  labels,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly items: readonly [Waste, ...Waste[]];
  readonly labels: {
    readonly autoclave: NonNullable<ReactNode>;
    readonly destination: NonNullable<ReactNode>;
    readonly destinations: Readonly<Record<Place, NonNullable<ReactNode>>>;
    readonly item: string;
    readonly items: Readonly<Partial<Record<Waste, string>>>;
    readonly reason?: NonNullable<ReactNode>;
    readonly reasons?: Readonly<Partial<Record<Waste, NonNullable<ReactNode>>>>;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [active, setActive] = useState<Waste>(items[0]);
  const quantity = useQuantity();

  const route = useMemo(() => {
    const index = Option.getOrElse(
      Arr.findFirstIndex(items, (entry) => entry === active),
      () => 0
    );
    return routeOf(active, slotOf(index, items.length));
  }, [active, items]);

  const [seconds, setSeconds] = useState(() => durationOf(route));

  const pick = useCallback(
    (next: Waste) => {
      const index = Option.getOrElse(
        Arr.findFirstIndex(items, (entry) => entry === next),
        () => 0
      );
      const nextRoute = routeOf(next, slotOf(index, items.length));
      setActive(next);
      setSeconds(durationOf(nextRoute));
    },
    [items]
  );

  const place = placeOf(active);
  const pose = poseAt(route, seconds);
  const celsius = celsiusAt(pose.heat);
  const pressure = gaugePressure(celsius);
  const reason = labels.reasons?.[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          const first = routeOf(items[0], slotOf(0, items.length));
          setActive(items[0]);
          setSeconds(durationOf(first));
        }}
      />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.item}
          gridColumns={toggleColumns(items.length)}
          onValueChange={(value: string) => {
            const found = Arr.findFirst(items, (entry) => entry === value);
            if (Option.isSome(found)) {
              pick(found.value);
            }
          }}
          type="single"
          value={active}
          variant="outline"
        >
          {Arr.map(items, (entry) => (
            <ToggleGroupItem key={entry} value={entry}>
              {labels.items[entry] ?? entry}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={1.2} setting="lab">
          <Suspense fallback={null}>
            <WasteScene
              active={active}
              items={items}
              names={labels.items}
              onPick={pick}
              onSeconds={setSeconds}
              route={route}
              seconds={seconds}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.destination}
            value={labels.destinations[place]}
          />
          <VisualFactTabular
            label={labels.autoclave}
            value={
              throughAutoclave(active) ? (
                <InlineMath
                  math={`${quantity(celsius, UNIT.temperature, 0)},\\; ${quantity(pressure, "\\text{ kPa}", 0)},\\; ${quantity(STERILISE.minutes, "\\text{ min}", 0)}`}
                />
              ) : (
                <InlineMath math={quantity(celsius, UNIT.temperature, 0)} />
              )
            }
          />
          {labels.reason !== undefined && reason !== undefined && (
            <VisualFact label={labels.reason} value={reason} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
