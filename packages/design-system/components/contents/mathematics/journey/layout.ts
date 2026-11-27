import { Array as Arr } from "effect";

/**
 * Where everything lies on the diorama, in metres, in the road's own frame:
 * the road runs along z with its middle line at x = 0, from its start at
 * z = +length / 2 to the farthest place of the journey at z = -length / 2.
 * The scene turns this frame a quarter turn, so the learner sees the road
 * run from left to right, with the bus stops and the hills behind it and the
 * kilometre posts in front.
 */

/** The road across: the flat strip it lies on, its asphalt, and how far each lane lies from the middle. */
export const BOARD = { asphalt: 0.064, lane: 0.016, width: 0.13 } as const;

/** The road along: how long the journey's farthest distance is drawn, and how far the road runs on past it at each end. */
export const ROAD = { length: 0.66, runOn: 0.06 } as const;

/** How far the land reaches from the road's middle line, behind the road and in front of it. */
export const LAND = { back: 0.4, front: 0.13 } as const;

/** Half the diorama's length, from its middle to either end. */
export const HALF = ROAD.length / 2 + ROAD.runOn;

/** Where `km` from the start lies along the road, when the road's far end stands for `top` kilometres. */
export function roadZ(top: number, km: number) {
  return ROAD.length / 2 - (km / top) * ROAD.length;
}

/**
 * Where a vehicle drives across the road, by which way it faces, from 0 away
 * from the start to 1 back toward it. Traffic keeps to the left, as on the
 * roads of Malaysia and Indonesia, so a bus heading away keeps to the left
 * lane, seen from the start, and moves over as it turns round.
 */
export function laneX(facing: number) {
  return BOARD.lane * (2 * facing - 1);
}

/** How far apart the roadside trees stand, and how far they keep from a bus stop, in metres. */
const TREES = { clear: 0.042, gap: 0.085 } as const;

/** Where the roadside trees stand along the road, from `back` to `front`, leaving room for every stop. */
export function treeSpots(
  back: number,
  front: number,
  stops: readonly number[]
) {
  return Arr.filter(
    Arr.makeBy(
      Math.floor((front - back) / TREES.gap),
      (index) => back + (index + 0.5) * TREES.gap
    ),
    (z) => Arr.every(stops, (stop) => Math.abs(stop - z) >= TREES.clear)
  );
}

/** How much more of the view the camera leaves round the diorama. */
const MARGIN = 1.08;

/**
 * Where the camera stands: its target in the middle of the diorama, and how
 * far back it stands along a line at `elevation` above the table, so the
 * whole road and the land behind it fit a card of `aspect`. A card taller
 * than wide sees across as much as a square one, as the shared camera widens
 * its view there.
 */
export function viewOf(
  frame: { readonly aspect: number; readonly fov: number },
  elevation: number
) {
  const deep = (LAND.back + LAND.front) / 2;
  const slope = Math.tan((frame.fov * Math.PI) / 360);
  const fitAcross =
    HALF / (slope * Math.max(frame.aspect, 1)) + deep * Math.cos(elevation);
  const fitDeep = (deep * Math.sin(elevation)) / slope;
  return {
    distance: Math.max(fitAcross, fitDeep) * MARGIN,
    target: (LAND.front - LAND.back) / 2,
  };
}
