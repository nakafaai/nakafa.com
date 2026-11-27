import type {
  Road,
  Town,
} from "@repo/design-system/components/contents/mathematics/network/graph";
import { degreesOf } from "@repo/design-system/components/contents/mathematics/network/graph";
import { layoutTowns } from "@repo/design-system/components/contents/mathematics/network/layout";
import type { Route } from "@repo/design-system/components/contents/mathematics/network/paths";
import {
  legLengths,
  longestFirst,
  routeChoices,
  shortestRoute,
} from "@repo/design-system/components/contents/mathematics/network/paths";
import type { NetworkMode } from "@repo/design-system/components/contents/mathematics/network/scene";
import { NetworkScene } from "@repo/design-system/components/contents/mathematics/network/scene";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
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
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useState } from "react";

/** The two modes, in the order the toolbar offers them. */
const MODES = ["degrees", "route"] as const satisfies readonly NetworkMode[];

/** The room the towns take on the board, inside its edge, and how far apart any two stand. */
const TOWN_FIELD = { depth: 0.42, gap: 0.17, width: 0.72 } as const;

/** The stage's floor: the planning table's top. */
const FLOOR = -0.03;

/** How far the board reaches from its middle, in metres. */
const REACH = 0.55;

/** The toolbar grid for each number of towns, so no row of town buttons has a gap that reads as a missing town. */
const TOWN_COLUMNS: Partial<Record<number, "2" | "3" | "4" | "6">> = {
  2: "2",
  3: "3",
  4: "4",
  6: "6",
  8: "4",
};

/**
 * A network as a model landscape on a planning table: towns are the
 * vertices, roads the edges, each road's plate its weight in kilometres. In
 * the degrees mode every town's sign gives how many roads meet there, the
 * roads of a town light up when the learner points at it, taps it or picks it
 * in the toolbar, playing lights each town's roads in turn, and the footer
 * adds the degrees up to twice the number of roads. In the route mode the
 * learner picks a simple route from the start to the end and a lit bead
 * drives it, and the footer adds up its roads.
 * With `showShortest`, the footer also totals each route and names the
 * shortest, and playing drives every route from the longest to the shortest;
 * without it, as in a question that asks for the shortest distance, playing
 * drives the chosen route only and its roads stay an unsolved sum.
 */
export function RouteNetworkLab({
  description,
  end,
  labels,
  mode: startMode = "degrees",
  roads,
  showShortest = false,
  start,
  title,
  towns,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly end: string;
  readonly labels: {
    readonly degreeSum: ReactNode;
    readonly length: ReactNode;
    readonly mode: string;
    readonly modes: Readonly<Record<NetworkMode, string>>;
    readonly route: string;
    readonly shortest: ReactNode;
    readonly town: string;
    readonly trip: ReactNode;
    readonly twiceRoads: ReactNode;
    readonly viewLabel: string;
  };
  readonly mode?: NetworkMode;
  readonly roads: readonly Road[];
  readonly showShortest?: boolean;
  readonly start: string;
  readonly title: NonNullable<ReactNode>;
  readonly towns: readonly Town[];
}) {
  const quantity = useQuantity();
  const [mode, setMode] = useState<NetworkMode>(startMode);
  const [picked, setPicked] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [counted, setCounted] = useState<string | null>(null);
  const [chosen, setChosen] = useState(0);
  const [driven, setDriven] = useState<number | null>(null);
  const spots = useMemo(
    () => layoutTowns(towns, roads, TOWN_FIELD),
    [roads, towns]
  );
  const routes = useMemo(
    () => routeChoices(towns, roads, start, end),
    [end, roads, start, towns]
  );
  const degrees = degreesOf(towns, roads);
  const nameOf = (id: string) =>
    Option.match(
      Arr.findFirst(towns, (town) => town.id === id),
      { onNone: () => id, onSome: (town) => town.name }
    );
  const routeName = (route: Route) => Arr.join(Arr.map(route, nameOf), " → ");
  const items = Arr.map(routes, (route, index) => ({
    label: routeName(route),
    value: index,
  }));
  const run = useMemo(
    () => (showShortest ? longestFirst(roads, routes) : [chosen]),
    [chosen, roads, routes, showShortest]
  );
  const shown = driven ?? chosen;
  const shownRoute = Arr.getUnsafe(routes, shown);
  const km = (value: number) => quantity(value, "\\text{ km}", 1);
  const legs = Arr.join(
    Arr.map(legLengths(roads, shownRoute), (leg) => quantity(leg, "", 1)),
    " + "
  );
  const total = Arr.reduce(legLengths(roads, shownRoute), 0, (a, b) => a + b);
  const shortest = shortestRoute(towns, roads, start, end);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.mode}
          onValueChange={(value: string) => {
            Option.map(
              Arr.findFirst(MODES, (each) => each === value),
              setMode
            );
          }}
          type="single"
          value={mode}
          variant="outline"
        >
          {Arr.map(MODES, (each) => (
            <ToggleGroupItem key={each} value={each}>
              {labels.modes[each]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {mode === "degrees" ? (
          <ToggleGroup
            aria-label={labels.town}
            gridColumns={TOWN_COLUMNS[towns.length] ?? "auto"}
            onValueChange={(value: string) =>
              setPicked(value === "" ? null : value)
            }
            type="single"
            value={picked ?? ""}
            variant="outline"
          >
            {Arr.map(towns, (town) => (
              <ToggleGroupItem key={town.id} value={town.id}>
                {town.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : (
          <Select
            items={items}
            onValueChange={(next: number | null) => {
              if (next !== null) {
                setChosen(next);
              }
            }}
            value={chosen}
          >
            <SelectTrigger aria-label={labels.route} className="w-full">
              <SelectValue labels={Arr.map(items, (item) => item.label)} />
            </SelectTrigger>
            <SelectContent label={labels.route}>
              {Arr.map(items, (item) => (
                <SelectItem key={item.value} plain value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={FLOOR} reach={REACH} setting="lab">
          <Suspense fallback={null}>
            <NetworkScene
              chosen={chosen}
              degrees={degrees}
              end={end}
              focus={counted ?? hovered ?? picked}
              lit={shown}
              mode={mode}
              onCount={setCounted}
              onDrive={setDriven}
              onFocus={setHovered}
              onPick={(town) =>
                setPicked((current) => (current === town ? null : town))
              }
              plates={Arr.map(roads, (road) => quantity(road.length, "", 1))}
              roads={roads}
              routes={routes}
              run={run}
              spots={spots}
              start={start}
              towns={towns}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        {mode === "degrees" ? (
          <VisualCardFacts>
            <VisualFactTabular
              label={labels.degreeSum}
              value={
                <InlineMath
                  math={`${Arr.join(Arr.map(degrees, String), " + ")} = ${Arr.reduce(degrees, 0, (a, b) => a + b)}`}
                />
              }
            />
            <VisualFactTabular
              label={labels.twiceRoads}
              value={
                <InlineMath
                  math={`2 \\times ${roads.length} = ${2 * roads.length}`}
                />
              }
            />
          </VisualCardFacts>
        ) : (
          <VisualCardFacts>
            <VisualFactTabular
              label={labels.trip}
              value={routeName(shownRoute)}
            />
            <VisualFactTabular
              label={labels.length}
              value={
                <InlineMath
                  math={showShortest ? `${legs} = ${km(total)}` : legs}
                />
              }
            />
            {showShortest && Option.isSome(shortest) ? (
              <VisualFactTabular
                label={labels.shortest}
                value={
                  <span>
                    {routeName(shortest.value.route)},{" "}
                    <InlineMath math={km(shortest.value.length)} />
                  </span>
                }
              />
            ) : null}
          </VisualCardFacts>
        )}
      </VisualCardFooter>
    </VisualCard>
  );
}
