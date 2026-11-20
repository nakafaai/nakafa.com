// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option, Schema } from "effect";
import { DISTANCE, eyeOf } from "@/lib/island/camera";
import { depthAt, heightAt, landOf, surfaceAt } from "@/lib/island/land/ground";
import { homeOf } from "@/lib/island/land/home";
import {
  followRig,
  orbitOf,
  panRig,
  Rig,
  restRig,
  rigAt,
  stepRig,
  turnRig,
  zoomRig,
} from "@/lib/island/rig";

const SEED = 4242;

/** The lattice point every world of the seed opens on. */
const [HOME_X, HOME_Z] = homeOf(SEED);

/** Where the fox is and how fast it walks. */
type Fox = Parameters<typeof stepRig>[2];

/** The top of what a camera must clear at a place: the ground, or the water over it. */
type Top = Parameters<typeof stepRig>[3];

/** A fox standing still at a place. */
function foxAt(x: number, z: number): Fox {
  return { speedX: 0, speedZ: 0, x, z };
}

/** A rig moved on by `seconds` in `frames` equal steps, the fox read at the end of each. */
function after(
  rig: Rig,
  seconds: number,
  frames: number,
  fox: (time: number) => Fox,
  top: Top
) {
  return Arr.reduce(Arr.range(1, frames), rig, (moved, frame) =>
    stepRig(moved, seconds / frames, fox((seconds * frame) / frames), top)
  );
}

/** Level ground ten blocks high. */
const level: Top = () => 10;

/** How far the line of sight of a rig's orbit clears the land at its closest, read at six points from its target to its lens. */
function clearanceOf(orbit: ReturnType<typeof orbitOf>, top: Top) {
  const eye = eyeOf(orbit);
  return Math.min(
    ...Arr.map(Arr.range(1, 6), (part) => {
      const share = part / 6;
      const x = orbit.target[0] + (eye[0] - orbit.target[0]) * share;
      const z = orbit.target[2] + (eye[2] - orbit.target[2]) * share;
      return orbit.target[1] + (eye[1] - orbit.target[1]) * share - top(x, z);
    })
  );
}

describe("island/rig", () => {
  it("starts at rest over a place, on the fox, looking down at it from above", () => {
    const rig = rigAt(4, 10, -6);
    expect(Schema.is(Rig)(rig)).toBe(true);
    expect(rig.follow).toBe(true);
    const orbit = orbitOf(rig);
    expect(orbit.distance).toBe(rig.distance);
    expect(orbit.target[0]).toBe(4);
    expect(orbit.target[2]).toBe(-6);
    expect(orbit.target[1]).toBeGreaterThan(10);
    expect(orbit.target[1]).toBeLessThan(11);
    expect(eyeOf(orbit)[1]).toBeGreaterThan(orbit.target[1] + 5);
    expect(after(rig, 1, 60, () => foxAt(4, -6), level)).toEqual(rig);
  });

  it("eases to the fox, its turn and its distance alike at 30 and 120 frames a second", () => {
    const land = landOf(SEED);
    const top: Top = (x, z) =>
      Math.max(heightAt(land, x, z), surfaceAt(land, x, z));
    const start = turnRig(
      zoomRig(
        rigAt(HOME_X - 12, top(HOME_X - 12, HOME_Z + 7), HOME_Z + 7),
        2.5,
        [0, 0]
      ),
      1.1,
      0.2,
      0
    );
    const still = () => foxAt(HOME_X, HOME_Z);
    const slow = after(start, 0.5, 15, still, top);
    const fast = after(start, 0.5, 60, still, top);
    for (const key of ["x", "z", "yaw", "distance"] as const) {
      expect(slow[key]).toBeCloseTo(fast[key], 9);
    }
    // Its height follows the ground it passes over, which the two read at different places on the way.
    expect(Math.abs(slow.y - fast.y)).toBeLessThan(0.1);
    // Half a second in, it is on its way and not there yet.
    expect(slow.x).toBeGreaterThan(start.x + 6);
    expect(slow.x).toBeLessThan(HOME_X - 0.2);
    expect(slow.distance).toBeGreaterThan(start.distance + 10);
    expect(slow.distance).toBeLessThan(start.goalDistance - 0.2);
    const rested = after(start, 4, 120, still, top);
    expect(rested.x).toBeCloseTo(HOME_X, 6);
    expect(rested.z).toBeCloseTo(HOME_Z, 6);
    expect(rested.y).toBeCloseTo(top(HOME_X, HOME_Z), 4);
    expect(rested.distance).toBeCloseTo(17 * 2.5, 6);
    expect(rested.yaw).toBeCloseTo(0.6 + 1.1, 6);
    expect(orbitOf(rested).pitch).toBeGreaterThan(orbitOf(start).pitch);
  });

  it("follows a walking fox a little ahead of where it walks, at either frame rate", () => {
    const walking = (time: number): Fox => ({
      speedX: 3,
      speedZ: -1,
      x: 3 * time,
      z: -time,
    });
    const start = rigAt(0, 10, 0);
    const slow = after(start, 2, 60, walking, level);
    const fast = after(start, 2, 240, walking, level);
    // Chasing a goal that moves, a longer frame trails by a hand's width more, and no more.
    expect(Math.abs(slow.x - fast.x)).toBeLessThan(0.1);
    expect(Math.abs(slow.z - fast.z)).toBeLessThan(0.1);
    expect(fast.x).toBeGreaterThan(6.5);
    expect(fast.x).toBeLessThan(6 + 1.5);
    expect(fast.z).toBeLessThan(-2.1);
    expect(fast.z).toBeGreaterThan(-2 - 0.5);
    // Once the fox stands, the lead goes and the rig comes to rest on it.
    const stood = after(fast, 4, 240, () => foxAt(6, -2), level);
    expect(stood.x).toBeCloseTo(6, 3);
    expect(stood.z).toBeCloseTo(-2, 3);
  });

  it("rises over a hill of the land that stands between the lens and the fox", () => {
    const land = landOf(SEED);
    const top: Top = (x, z) =>
      Math.max(heightAt(land, x, z), surfaceAt(land, x, z));
    const settled = (x: number, z: number) =>
      after(
        turnRig(rigAt(x, top(x, z), z), -0.6, 0, 0),
        3,
        90,
        () => foxAt(x, z),
        top
      );
    const hill = Option.getOrThrow(
      Arr.findFirst(
        Arr.flatMap(Arr.range(1, 20), (ring) =>
          Arr.makeBy(ring * 6, (slot) => {
            const turn = (slot / (ring * 6)) * Math.PI * 2;
            return [
              HOME_X + Math.round(Math.cos(turn) * ring * 6),
              HOME_Z + Math.round(Math.sin(turn) * ring * 6),
            ] as const;
          })
        ),
        ([x, z]) => depthAt(land, x, z) < 0 && settled(x, z).lift > 0.15
      )
    );
    const risen = settled(hill[0], hill[1]);
    const open = settled(HOME_X, HOME_Z);
    expect(open.lift).toBe(0);
    const orbit = orbitOf(risen);
    expect(orbit.pitch).toBeCloseTo(orbitOf(open).pitch + risen.lift, 6);
    expect(clearanceOf(orbit, top)).toBeGreaterThan(1);
    expect(clearanceOf(orbit, top)).toBeGreaterThan(
      clearanceOf({ ...orbit, pitch: orbit.pitch - risen.lift }, top)
    );
    expect(clearanceOf(orbitOf(open), top)).toBeGreaterThan(1);
  });

  it("rises fast and comes back down slowly, and never looks down steeper than a wall lets it", () => {
    // A ridge across the line from the fox to the lens, which looks from +z at this turn.
    const ridge: Top = (_, z) => (z > 5 && z < 9 ? 30 : 10);
    const start: Rig = { ...rigAt(0, 10, 0), goalYaw: 0, yaw: 0 };
    const still = () => foxAt(0, 0);
    const need = after(start, 3, 90, still, ridge).lift;
    expect(need).toBeGreaterThan(0.3);
    const rising = after(start, 0.1, 6, still, ridge).lift;
    const falling = after({ ...start, lift: need }, 0.1, 6, still, level).lift;
    expect(rising / need).toBeGreaterThan(0.6);
    expect((need - falling) / need).toBeLessThan(0.25);
    expect(
      after({ ...start, lift: need }, 6, 180, still, level).lift
    ).toBeLessThan(1e-3);
    // Walls all around that no tilt can clear take the rig as high as it goes, and the lens stops short of straight down.
    const wall: Top = (x, z) => (Math.hypot(x, z) > 1 ? 1000 : 10);
    const walled = after(
      turnRig(zoomRig(start, 1000, [0, 0]), 0, 5, 0),
      6,
      180,
      still,
      wall
    );
    expect(walled.lift).toBeCloseTo(0.7, 6);
    expect(walled.distance).toBeCloseTo(DISTANCE.far, 3);
    expect(orbitOf(walled).pitch).toBeLessThan(Math.PI / 2 - 0.1);
    expect(orbitOf(walled).pitch).toBeGreaterThan(
      orbitOf(after(start, 6, 180, still, ridge)).pitch
    );
  });

  it("moves with a drag at once, lets go of the fox, and glides on with the drag's speed until it rests", () => {
    const start = rigAt(0, 10, 0);
    const fox = () => foxAt(0, 0);
    const dragged = panRig(start, 2, -1, 0.05);
    expect(dragged.follow).toBe(false);
    expect(dragged.x).toBe(2);
    expect(dragged.z).toBe(-1);
    expect(dragged.goalX).toBe(2);
    expect(dragged.speedX).toBeGreaterThan(0);
    expect(dragged.speedZ).toBeLessThan(0);
    // A second drag goes on from where the first left the goal, not from the lens.
    const again = panRig({ ...dragged, x: 2.5 }, 1, 0, 0.05);
    expect(again.goalX).toBe(3);
    expect(again.x).toBe(3.5);
    const glided = after(dragged, 4, 240, fox, level);
    expect(glided.x).toBeGreaterThan(4);
    expect(glided.z).toBeLessThan(-2);
    expect(glided.z / glided.x).toBeCloseTo(-0.5, 3);
    expect(Math.abs(glided.speedX)).toBeLessThan(1e-3);
    expect(glided.follow).toBe(false);
    // Held still, it stays where the drag put it.
    const held = after(restRig(dragged), 4, 240, fox, level);
    expect(restRig(dragged).speedX).toBe(0);
    expect(held.x).toBeCloseTo(2, 6);
    expect(held.z).toBeCloseTo(-1, 6);
  });

  it("stays within its leash of the fox however hard it is thrown", () => {
    const fox = () => foxAt(20, -10);
    const thrown = panRig(rigAt(20, 10, -10), 60, -80, 0.02);
    expect(Math.hypot(thrown.speedX, thrown.speedZ)).toBeGreaterThan(1000);
    const frames = Arr.scan(Arr.range(1, 240), thrown, (rig) =>
      stepRig(rig, 1 / 60, fox(), level)
    );
    for (const rig of Arr.drop(frames, 1)) {
      expect(Math.hypot(rig.goalX - 20, rig.goalZ + 10)).toBeLessThanOrEqual(
        100 + 1e-9
      );
    }
    const rested = Option.getOrThrow(Arr.last(frames));
    expect(Math.hypot(rested.x - 20, rested.z + 10)).toBeCloseTo(100, 3);
    expect((rested.z + 10) / (rested.x - 20)).toBeCloseTo(-80 / 60, 3);
  });

  it("zooms between its nearest and farthest, toward the pointer while it roams", () => {
    const following = rigAt(0, 10, 0);
    expect(zoomRig(following, 0.5, [9, 9]).goalDistance).toBe(8.5);
    expect(zoomRig(following, 0.5, [9, 9]).goalX).toBe(0);
    expect(zoomRig(following, 0.01, [0, 0]).goalDistance).toBe(DISTANCE.near);
    expect(zoomRig(following, 1000, [0, 0]).goalDistance).toBe(DISTANCE.far);
    const roaming = restRig(panRig(following, 4, 2, 0.1));
    const closer = zoomRig(roaming, 0.5, [10, -6]);
    // The place under the pointer keeps its place on the screen: the goal comes half the way to it.
    expect(closer.goalX).toBe(7);
    expect(closer.goalZ).toBe(-2);
    // Held at its nearest, a zoom moves nothing.
    const nearest = zoomRig(roaming, 0.01, [10, -6]);
    expect(zoomRig(nearest, 0.5, [50, 50]).goalX).toBeCloseTo(nearest.goalX, 9);
    const settled = after(closer, 3, 180, () => foxAt(0, 0), level);
    expect(settled.distance).toBeCloseTo(8.5, 6);
    expect(settled.x).toBeCloseTo(7, 6);
  });

  it("turns with a spin that fades after a drag, by a plain step for a turn of no time, and tilts within bounds", () => {
    const start = rigAt(0, 10, 0);
    const fox = () => foxAt(0, 0);
    const stepped = turnRig(start, 0.5, 0, 0);
    expect(stepped.speedYaw).toBe(0);
    expect(after(stepped, 3, 180, fox, level).yaw).toBeCloseTo(1.1, 6);
    const spun = turnRig(start, 0.5, 0, 0.05);
    expect(spun.goalYaw).toBe(stepped.goalYaw);
    expect(spun.speedYaw).toBeGreaterThan(5);
    const rested = after(spun, 4, 240, fox, level);
    expect(rested.yaw).toBeGreaterThan(1.1 + 1);
    expect(Math.abs(rested.speedYaw)).toBeLessThan(1e-6);
    expect(restRig(spun).speedYaw).toBe(0);
    expect(after(restRig(spun), 3, 180, fox, level).yaw).toBeCloseTo(1.1, 6);
    const up = turnRig(start, 0, 5, 0);
    const down = turnRig(start, 0, -5, 0);
    expect(up.tilt).toBeLessThan(0.5);
    expect(down.tilt).toBeGreaterThan(-0.5);
    expect(orbitOf(up).pitch).toBeGreaterThan(orbitOf(start).pitch + 0.3);
    expect(orbitOf(down).pitch).toBeLessThan(orbitOf(start).pitch - 0.3);
    // Close to the ground and tilted all the way down, the lens still looks over the grass, not along it.
    const near = after(zoomRig(start, 0.01, [0, 0]), 3, 180, fox, level);
    const low = after(zoomRig(down, 0.01, [0, 0]), 3, 180, fox, level);
    expect(orbitOf(low).pitch).toBeLessThan(orbitOf(near).pitch);
    expect(orbitOf(low).pitch).toBeGreaterThanOrEqual(0.2);
    expect(clearanceOf(orbitOf(low), level)).toBeGreaterThan(0.5);
  });

  it("comes back to the fox when asked, its tilt undone and its glide ended", () => {
    const fox = () => foxAt(1, 1);
    const away = turnRig(panRig(rigAt(1, 10, 1), 30, 5, 0.05), 0, 0.3, 0);
    const back = followRig(away);
    expect(back.follow).toBe(true);
    expect(back.tilt).toBe(0);
    const first = stepRig(back, 1 / 60, fox(), level);
    expect(first.speedX).toBe(0);
    expect(first.speedZ).toBe(0);
    expect(first.x).toBeLessThan(away.x);
    const home = after(back, 4, 240, fox, level);
    expect(home.x).toBeCloseTo(1, 6);
    expect(home.z).toBeCloseTo(1, 6);
  });
});
