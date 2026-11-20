import { Array as Arr, Option, Schema } from "effect";
import type { Land } from "@/lib/island/land/ground";
import {
  coverAt,
  flowAt,
  heightAt,
  normalAt,
  surfaceAt,
} from "@/lib/island/land/ground";
import { Fruit } from "@/lib/island/models/fruit";
import { SCALE } from "@/lib/island/scale";

/** What lies loose on the land: the play ball, and fruit. */
export const LooseKind = Schema.Literals(["ball", ...Fruit.literals]);
export type LooseKind = typeof LooseKind.Type;

/**
 * One loose thing (ADR 0050, W2): its name, its kind, where its middle is and
 * how fast it moves, in blocks and blocks a second, how far it has rolled, in
 * radians, and the way it rolls, whether it floats, and how long it has lain
 * still, in seconds.
 */
export const Loose = Schema.Struct({
  afloat: Schema.Boolean,
  heading: Schema.Finite,
  key: Schema.String,
  kind: LooseKind,
  roll: Schema.Finite,
  speedX: Schema.Finite,
  speedY: Schema.Finite,
  speedZ: Schema.Finite,
  still: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
  z: Schema.Finite,
});
export type Loose = typeof Loose.Type;

/**
 * How each kind is made, measured against the real thing: its `radius` in
 * blocks (a 40 cm ball, a 26 cm coconut, a 16 cm mango, a hand of bananas);
 * the share of its speed it keeps when it bounces; the `drag` the turf takes
 * from its roll for each block a second it moves, a second; the `grip` that
 * slows it by a fixed measure, in blocks a second squared, which is what
 * brings it to rest and holds it on a gentle slope; and its `draft`, the
 * share of its height that lies under the water's face when it floats.
 */
export const KINDS = {
  ball: { bounce: 0.68, draft: 0.2, drag: 0.9, grip: 1.2, radius: 0.22 },
  banana: { bounce: 0.15, draft: 0.7, drag: 2.5, grip: 4, radius: 0.12 },
  coconut: { bounce: 0.3, draft: 0.5, drag: 1.3, grip: 2, radius: 0.145 },
  mango: { bounce: 0.25, draft: 0.85, drag: 1.8, grip: 2.5, radius: 0.09 },
} as const satisfies Record<LooseKind, unknown>;

/** Real gravity, in blocks a second squared. */
const GRAVITY = 9.8 / SCALE.block;

/** How hard a hit must be before a thing bounces instead of settling, in blocks a second into the ground. */
const BOUNCE = 1.6;

/** How much less a path holds a rolling thing than turf does. */
const SMOOTH = 0.6;

/**
 * What water does to a loose thing where it stands at least `shallow` blocks
 * deep: it carries the thing's weight and pulls it to the height it floats
 * at, by `lift` a second squared for each block it is off it; the `drag` on
 * its rise and fall and the one that brings it to the water's own speed, a
 * second; and how fast a river and a sloping face carry it, in blocks a
 * second.
 */
const WATER = {
  drag: 5,
  follow: 1.6,
  lift: 46,
  river: 1.5,
  shallow: 0.06,
  slope: 2,
} as const;

/** When a loose thing counts as lying still: slower than this over the ground and up or down, in blocks a second, for this many seconds, after which it sleeps until something moves it. */
const REST = { fall: 0.3, roll: 0.06, seconds: 1.2 } as const;

/** How the fox kicks what it runs into: away from itself at its own speed and a push more, with a share of the way it was going, and up in a hop that grows with its speed, in blocks a second; and how slow a fox no longer kicks. */
const KICK = {
  carry: 0.3,
  hop: 1.4,
  least: 0.4,
  lift: 0.3,
  push: 0.8,
  share: 1,
} as const;

/** How a tap kicks the ball: from within this many blocks of the fox, this fast away from it and this fast up, in blocks a second. */
const TAP = { reach: 3, speed: 5, up: 3.5 } as const;

/** A loose thing of a kind lying still at a place. */
export function looseAt(
  kind: LooseKind,
  key: string,
  place: readonly [number, number, number]
): Loose {
  return {
    afloat: false,
    heading: 0,
    key,
    kind,
    roll: 0,
    speedX: 0,
    speedY: 0,
    speedZ: 0,
    still: 0,
    x: place[0],
    y: place[1],
    z: place[2],
  };
}

/** A loose thing in the water for one short moment: borne up to the height it floats at, slowed, and carried the way a river runs and a sloping face falls. */
function floated(land: Land, loose: Loose, face: number, seconds: number) {
  const kind = KINDS[loose.kind];
  const rest = face + kind.radius * (1 - 2 * kind.draft);
  const flow = flowAt(land, loose.x, loose.z);
  const tiltX =
    surfaceAt(land, loose.x + 1, loose.z) -
    surfaceAt(land, loose.x - 1, loose.z);
  const tiltZ =
    surfaceAt(land, loose.x, loose.z + 1) -
    surfaceAt(land, loose.x, loose.z - 1);
  const follow = Math.min(1, WATER.follow * seconds);
  return {
    ...loose,
    afloat: true,
    speedX:
      loose.speedX +
      (flow[0] * WATER.river - tiltX * WATER.slope - loose.speedX) * follow,
    speedY:
      (loose.speedY + (rest - loose.y) * WATER.lift * seconds) *
      Math.exp(-WATER.drag * seconds),
    speedZ:
      loose.speedZ +
      (flow[1] * WATER.river - tiltZ * WATER.slope - loose.speedZ) * follow,
  };
}

/** A loose thing that touched the ground for one short moment: set back on it, bounced off it when it hit hard, and slowed by the turf's drag and grip. */
function grounded(land: Land, loose: Loose, ground: number, seconds: number) {
  const kind = KINDS[loose.kind];
  const [nx, ny, nz] = normalAt(land, loose.x, loose.z);
  const into = loose.speedX * nx + loose.speedY * ny + loose.speedZ * nz;
  const off = Math.min(0, into) * (into < -BOUNCE ? 1 + kind.bounce : 1);
  const [vx, vz] = [loose.speedX - off * nx, loose.speedZ - off * nz];
  const speed = Math.hypot(vx, vz);
  const hold = coverAt(land, loose.x, loose.z) === "path" ? SMOOTH : 1;
  const slowed = Math.max(
    0,
    speed * Math.exp(-kind.drag * hold * seconds) - kind.grip * hold * seconds
  );
  const keep = speed > 0 ? slowed / speed : 0;
  return {
    ...loose,
    speedX: vx * keep,
    speedY: loose.speedY - off * ny,
    speedZ: vz * keep,
    y: ground + kind.radius,
  };
}

/** A loose thing after one short moment: water it lies in bears it up, and gravity pulls it down anywhere else; it moves; and it meets the ground. */
function moment(land: Land, loose: Loose, seconds: number): Loose {
  const radius = KINDS[loose.kind].radius;
  const face = surfaceAt(land, loose.x, loose.z);
  const wet =
    face > heightAt(land, loose.x, loose.z) + WATER.shallow &&
    loose.y - radius < face;
  const pulled = wet
    ? floated(land, loose, face, seconds)
    : { ...loose, afloat: false, speedY: loose.speedY - GRAVITY * seconds };
  const moved = {
    ...pulled,
    x: pulled.x + pulled.speedX * seconds,
    y: pulled.y + pulled.speedY * seconds,
    z: pulled.z + pulled.speedZ * seconds,
  };
  const ground = heightAt(land, moved.x, moved.z);
  return moved.y - radius < ground
    ? grounded(land, moved, ground, seconds)
    : moved;
}

/**
 * A loose thing after `seconds` (ADR 0050, W2): it falls, bounces off the
 * ground, rolls downhill and is slowed by the turf until it comes to rest,
 * floats on water and drifts with a river, and turns as it rolls. One that
 * has lain still long enough sleeps and is left as it is. A fast one is moved
 * in short moments, so it never passes through the ground.
 */
export function stepLoose(land: Land, loose: Loose, seconds: number): Loose {
  if (loose.still > REST.seconds || seconds <= 0) {
    return loose;
  }
  const radius = KINDS[loose.kind].radius;
  const reach =
    Math.hypot(loose.speedX, loose.speedY - GRAVITY * seconds, loose.speedZ) *
    seconds;
  const moments = Math.max(1, Math.ceil(reach / (radius * 0.8)));
  const moved = Arr.reduce(Arr.range(1, moments), loose, (at) =>
    moment(land, at, seconds / moments)
  );
  const speed = Math.hypot(moved.speedX, moved.speedZ);
  const resting = speed < REST.roll && Math.abs(moved.speedY) < REST.fall;
  return {
    ...moved,
    heading:
      speed > 0.02 ? Math.atan2(moved.speedX, moved.speedZ) : moved.heading,
    roll: moved.roll + (speed * seconds) / radius,
    still: resting ? moved.still + seconds : 0,
  };
}

/**
 * A loose thing the fox ran into, none when the fox is too slow, too far or
 * at another height: it flies off the way the fox pushes it, with a hop.
 */
export function bumped(
  loose: Loose,
  fox: {
    readonly speedX: number;
    readonly speedZ: number;
    readonly x: number;
    readonly y: number;
    readonly z: number;
  },
  body: number
) {
  const [dx, dz] = [loose.x - fox.x, loose.z - fox.z];
  const distance = Math.hypot(dx, dz);
  const speed = Math.hypot(fox.speedX, fox.speedZ);
  if (
    distance >= KINDS[loose.kind].radius + body ||
    Math.abs(loose.y - fox.y) >= 0.9 ||
    speed <= KICK.least
  ) {
    return Option.none();
  }
  const push = speed * KICK.share + KICK.push;
  const away = Math.max(distance, 1e-6);
  return Option.some<Loose>({
    ...loose,
    speedX: (dx / away) * push + fox.speedX * KICK.carry,
    speedY: Math.max(loose.speedY, KICK.hop + speed * KICK.lift),
    speedZ: (dz / away) * push + fox.speedZ * KICK.carry,
    still: 0,
  });
}

/** A loose thing the learner tapped, kicked away from the fox with a hop, none when it lies out of the fox's reach. */
export function tapped(loose: Loose, fox: readonly [number, number]) {
  const [dx, dz] = [loose.x - fox[0], loose.z - fox[1]];
  const distance = Math.hypot(dx, dz);
  if (distance >= TAP.reach) {
    return Option.none();
  }
  const away = Math.max(distance, 1e-6);
  return Option.some<Loose>({
    ...loose,
    speedX: (dx / away) * TAP.speed,
    speedY: TAP.up,
    speedZ: (dz / away) * TAP.speed,
    still: 0,
  });
}
