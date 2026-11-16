import { POP } from "@repo/mascot/color";
import { type Curve, flip } from "@repo/mascot/nina/limb";
import type { Place } from "@repo/mascot/nina/point";
import {
  armLeft,
  breathe,
  type Pose,
  REST,
  sway,
  swayLegs,
} from "@repo/mascot/nina/pose";
import {
  ballot,
  box,
  broom,
  brush,
  bubbles,
  camera,
  can,
  chart,
  clipboard,
  easel,
  envelope,
  folder,
  plug,
  rod,
  sprout,
  wand,
} from "@repo/mascot/nina/tool";

/** The arms that hold a thing in front of her, from either side, their tips at the height `y`. */
function holding(y: number): readonly [Curve, Curve] {
  const arm = armLeft(20, 166, 28, y + 14, 66, y);
  return [arm, flip(arm)];
}

/** Her right arm reaching out beside her, its tip at `hand`. */
function reaching(hand: Place): Curve {
  return [124, 146, 176, 148, 198, 154, hand[0], hand[1]];
}

/** Her right arm raised high, its tip at `hand`. */
function raised(hand: Place): Curve {
  return [124, 146, 196, 166, 238, 110, hand[0], hand[1]];
}

/** Wishing on a star: a star held up high that turns and twinkles. The starred list with nothing in it. */
export function wishing(t: number): Pose {
  const p = breathe(REST, t);
  const turn = Math.sin(t * 2.2) * 12;
  const hand: Place = [208 + Math.sin(t * 2.2) * 3, 44];
  return {
    ...p,
    armL: sway(p.armL, t, 0.3, 1),
    armR: raised(hand),
    held: wand(hand[0], hand[1], turn, Math.abs(Math.sin(t * 3))),
    look: [3, -3],
    mood: "happy",
    tilt: p.tilt - 2,
  };
}

/** Watering a sprout beside her, which grows with every round of the can. Something that grows once it starts. */
export function watering(t: number): Pose {
  const p = breathe(REST, t);
  const round = t % 5;
  const tip = round < 3.2 ? 24 : 0;
  return {
    ...p,
    above: sprout(Math.min(1, round / 3.2)),
    armL: sway(p.armL, t, 0.3, 1),
    armR: reaching([206, 140]),
    held: can(200, 128, tip + Math.sin(t * 4) * 3, t),
    look: [4, 3],
    mood: round < 3.2 ? "focused" : "proud",
  };
}

/** Fishing: a rod held out, its float bobbing on the water until it dips. Waiting for something to come. */
export function fishing(t: number): Pose {
  const p = breathe(REST, t);
  const round = t % 6;
  const bite = round > 4.4 && round < 5.2;
  return {
    ...p,
    armL: sway(p.armL, t, 0.3, 0.8),
    armR: reaching([218, 136]),
    held: rod(218, 136, bite ? 3 : Math.sin(t * 2.4) * 0.6),
    look: [4, 3],
    mood: bite ? "surprised" : "calm",
  };
}

/** Sweeping the floor with a broom, swept from side to side, and the dust it lifts. The trash with nothing in it. */
export function sweeping(t: number): Pose {
  const p = breathe(REST, t);
  const swing = Math.sin(t * 3.4);
  return {
    ...p,
    armL: sway(p.armL, t, 0.3, 1),
    armR: [124, 146, 170, 168, 186, 196, 196 + swing * 6, 210],
    held: broom(196 + swing * 6, 210, swing),
    layer: ["back", "front"],
    legs: swayLegs(REST.legs, t * 1.6, 1),
    look: [3, 4],
    mood: "focused",
    tilt: p.tilt + swing * 2,
  };
}

/** Opening a letter: an envelope in front of her, its flap lifting and a page rising out. The inbox with nothing new. */
export function mailing(t: number): Pose {
  const p = breathe(REST, t);
  const round = t % 4;
  const open = round < 1.2 ? 0 : Math.min(1, (round - 1.2) / 0.8);
  const [armL, armR] = holding(204);
  return {
    ...p,
    armL,
    armR,
    held: envelope(round < 3.4 ? open : 0),
    layer: ["front", "front"],
    look: [0, 3],
    mood: open > 0.9 ? "happy" : "calm",
  };
}

/** Ticking off a clipboard: one row after another, and a proud look once all three are done. The tasks to do. */
export function checking(t: number): Pose {
  const p = breathe(REST, t);
  const round = t % 5;
  const [armL, armR] = holding(210);
  return {
    ...p,
    armL,
    armR,
    held: clipboard(round < 4 ? round : 0),
    layer: ["front", "front"],
    look: [((round * 1.1) % 2) * 2 - 2, 3],
    mood: round > 3 && round < 4 ? "proud" : "focused",
  };
}

/** Peeking into a box in front of her, whose flaps open and close. What is put away. */
export function unboxing(t: number): Pose {
  const p = breathe(REST, t);
  const open = Math.max(0, Math.sin(t * 1.6));
  const [armL, armR] = holding(212);
  return {
    ...p,
    armL,
    armR,
    held: box(open),
    layer: ["front", "front"],
    look: [0, 4],
    mood: open > 0.8 ? "aha" : "curious",
  };
}

/** Filing a page into a folder in front of her. The files of a library. */
export function filing(t: number): Pose {
  const p = breathe(REST, t);
  const round = t % 3.2;
  const [armL, armR] = holding(214);
  return {
    ...p,
    armL,
    armR,
    held: folder(Math.min(1, round / 2)),
    layer: ["front", "front"],
    look: [0, 3],
    mood: round > 2 ? "happy" : "focused",
  };
}

/** A board of bars in front of her that grow one after another. The numbers that come with use. */
export function charting(t: number): Pose {
  const p = breathe(REST, t);
  const round = t % 4.5;
  const [armL, armR] = holding(212);
  return {
    ...p,
    armL,
    armR,
    held: chart(Math.min(1, round / 3)),
    layer: ["front", "front"],
    look: [0, 3],
    mood: round > 3 ? "proud" : "curious",
  };
}

/** Voting: a card in her hand that goes into the ballot box beside her. A question nobody has asked yet. */
export function voting(t: number): Pose {
  const p = breathe(REST, t);
  const round = t % 3;
  const down = Math.min(1, round / 1.6);
  const hand: Place = [214, 196 + down * 26];
  return {
    ...p,
    armL: sway(p.armL, t, 0.3, 1),
    armR: [124, 146, 176, 154, 206, 170, hand[0], hand[1]],
    held: ballot(hand[0], hand[1] + 6, round > 1.6 ? 1 : 0),
    look: [4, 4],
    mood: round > 1.6 ? "happy" : "focused",
  };
}

/** Painting on the canvas of an easel beside her, one stroke of colour after another. A place for pictures. */
export function painting(t: number): Pose {
  const p = breathe(REST, t);
  const round = t % 5;
  const painted = round < 4.2 ? Math.min(3, round / 1.2) : 0;
  const colours = [POP.red, POP.yellow, POP.green] as const;
  const hand: Place = [
    186 + Math.sin(t * 2.4) * 2,
    150 + Math.sin(t * 3.1) * 2,
  ];
  const tip: Place = [204 + Math.sin(t * 3) * 8, 96 + Math.cos(t * 2) * 10];
  return {
    ...p,
    above: easel(painted),
    armL: sway(p.armL, t, 0.3, 1),
    armR: [124, 146, 156, 176, 180, 172, hand[0], hand[1]],
    held: brush(hand, tip, colours[Math.min(2, Math.floor(painted))]),
    look: [3.5, -1],
    mood: round > 3.6 && round < 4.2 ? "proud" : "focused",
    tilt: p.tilt - 2,
  };
}

/** Taking a picture: a camera held up in front of her, and its flash every few seconds. A gallery with nothing in it. */
export function photographing(t: number): Pose {
  const p = breathe(REST, t);
  const round = t % 2.6;
  const [armL, armR] = holding(198);
  return {
    ...p,
    armL,
    armR,
    held: camera(round > 2 && round < 2.3 ? 1 : 0),
    layer: ["front", "front"],
    look: [0, 1],
    mood: round > 2 && round < 2.6 ? "winking" : "focused",
  };
}

/** Chatting: a bubble over her and one beside her, one after the other. A chat with no message yet. */
export function chatting(t: number): Pose {
  const p = breathe(REST, t);
  const turn = (t / 4) % 1;
  const talk = Math.sin(t * 6);
  return {
    ...p,
    above: bubbles(turn),
    armL: sway(p.armL, t, 0.3, 1),
    armR: [124, 146, 176, 150, 200 + talk * 4, 150, 214 + talk * 6, 128],
    look: [turn < 0.4 ? 3 : -3, -1],
    mood: "happy",
    tilt: p.tilt + (turn < 0.4 ? -2 : 2),
  };
}

/** Plugging a cable into the socket beside her, and the spark when it goes in. Nothing connected yet. */
export function plugging(t: number): Pose {
  const p = breathe(REST, t);
  const round = t % 3.4;
  const home = round > 1.6 && round < 2.8 ? 1 : 0;
  const reach = Math.min(1, round / 1.6) * (1 - Math.max(0, round - 2.8) / 0.6);
  const hand: Place = [196 + reach * 14, 138];
  return {
    ...p,
    armL: sway(p.armL, t, 0.3, 1),
    armR: reaching(hand),
    held: plug(hand[0] + 4, hand[1], home),
    look: [4, 0],
    mood: home > 0 ? "laughing" : "focused",
  };
}
