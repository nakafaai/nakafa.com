import type {
  Canvas2D,
  CanvasCache,
  Effects,
  PaintState,
  Palette,
} from "@repo/design-system/components/nina/draw";
import {
  cachedPath,
  DEG_TO_RAD,
  drawLimb,
  drawShape,
} from "@repo/design-system/components/nina/draw";
import { NINA, POP } from "@repo/mascot/color";
import {
  ARM,
  FIN,
  HEAD,
  LEANS,
  LEG,
  PALE,
  TORSO,
} from "@repo/mascot/nina/body";
import { face } from "@repo/mascot/nina/face";
import { legCurve } from "@repo/mascot/nina/figure";
import type { frame } from "@repo/mascot/nina/life";
import { exit } from "@repo/mascot/nina/limb";
import type { Mark } from "@repo/mascot/nina/mark";
import type { Shape } from "@repo/mascot/shape";
import { Record as Rec, String as Str } from "effect";

const LEG_INDICES = [0, 1, 2, 3] as const;

/** How long a blink lasts, in milliseconds. */
export const BLINK_DURATION = 160;
/** How long a newly held item takes to pop in, in milliseconds. */
export const POP_DURATION = 180;

/** The CSS variables in `identity.css` that Nina and her pop colours resolve from. */
const TOKEN_PROPERTIES = {
  [NINA.body]: "--color-nina-body",
  [NINA.face]: "--color-nina-face",
  [NINA.ink]: "--color-nina-ink",
  [POP.blue]: "--color-pop-blue",
  [POP.cream]: "--color-pop-cream",
  [POP.green]: "--color-pop-green",
  [POP.orange]: "--color-pop-orange",
  [POP.red]: "--color-pop-red",
  [POP.yellow]: "--color-pop-yellow",
} as const;

type FrameSnapshot = ReturnType<typeof frame>;

/** Reads Nina's resolved CSS tokens and current text colour from the canvas element. */
export function readPalette(element: Element): Palette {
  const computed = getComputedStyle(element);
  const tokens = Rec.map(TOKEN_PROPERTIES, (property, key) => {
    const value = Str.trim(computed.getPropertyValue(property));
    return value === "" ? key : value;
  });
  const text = Str.trim(computed.color);
  return { text: text === "" ? tokens[NINA.ink] : text, tokens };
}

/** Vertical scale of an open eye during a blink (`1 -> 0.1 -> 1` over `BLINK_DURATION`). */
export function blinkScale(elapsedMs: number) {
  if (elapsedMs <= 0 || elapsedMs >= BLINK_DURATION) {
    return 1;
  }
  const t = elapsedMs / BLINK_DURATION;
  const wave = t < 0.5 ? t * 2 : (1 - t) * 2;
  const eased = 1 - (1 - wave) * (1 - wave);
  return 1 - 0.9 * eased;
}

/** Ease-out progress (`0 -> 1`) for a newly held prop popping into Nina's arms. */
export function popProgress(elapsedMs: number) {
  if (elapsedMs <= 0) {
    return 0;
  }
  if (elapsedMs >= POP_DURATION) {
    return 1;
  }
  const rest = 1 - elapsedMs / POP_DURATION;
  return 1 - rest * rest * rest;
}

/** Draws a cached static body path in one solid colour. */
function drawStatic(
  ctx: Canvas2D,
  cache: CanvasCache,
  d: string,
  fill: string
) {
  ctx.fillStyle = fill;
  ctx.fill(cachedPath(cache, d));
}

/** Draws Nina's held items with optional pop-in scale and opacity. */
function drawHeld(
  ctx: Canvas2D,
  held: readonly Shape<Mark>[],
  palette: Palette,
  baseState: PaintState,
  cache: CanvasCache,
  effects: Effects
) {
  if (held.length === 0) {
    return;
  }
  ctx.save();
  const pop = effects.heldPop;
  const heldState: PaintState =
    pop < 1 ? { ...baseState, alpha: pop } : baseState;
  if (pop < 1) {
    const scale = 0.9 + 0.1 * pop;
    ctx.translate(102, 165);
    ctx.scale(scale, scale);
    ctx.translate(-102, -165);
  }
  for (const item of held) {
    drawShape(ctx, item, palette, heldState, cache, effects);
  }
  ctx.restore();
}

/** Draws Nina's upper body: fin, back arms, torso, head, face, held goods and front arms. */
function drawUpper(
  ctx: Canvas2D,
  snapshot: FrameSnapshot,
  palette: Palette,
  baseState: PaintState,
  cache: CanvasCache,
  effects: Effects
) {
  const { pose } = snapshot;
  const body = palette.tokens[NINA.body];
  const pale = palette.tokens[NINA.face];
  const arms = snapshot.mode !== "tile";

  ctx.save();
  ctx.translate(pose.shift, pose.lift);
  ctx.translate(102, 210);
  ctx.rotate(pose.tilt * DEG_TO_RAD);
  ctx.translate(-102, -210);

  if (snapshot.mode !== "peek") {
    drawStatic(ctx, cache, FIN, body);
  }
  if (arms) {
    drawLimb(ctx, pose.armL, ARM, 0, body);
    drawLimb(ctx, pose.armR, ARM, 0, body);
  }
  drawStatic(ctx, cache, TORSO, body);
  drawStatic(ctx, cache, HEAD, body);
  drawStatic(ctx, cache, PALE, pale);

  for (const part of face(snapshot.mood, snapshot.look)) {
    drawShape(ctx, part, palette, baseState, cache, effects);
  }
  drawHeld(ctx, pose.held, palette, baseState, cache, effects);

  if (arms && pose.layer[0] === "front") {
    drawLimb(ctx, pose.armL, ARM, exit(pose.armL, ARM), body);
  }
  if (arms && pose.layer[1] === "front") {
    drawLimb(ctx, pose.armR, ARM, exit(pose.armR, ARM), body);
  }
  ctx.restore();
}

/** Draws a full live Nina frame onto `ctx`, matching the SVG figure layer for layer. */
export function drawFrame(
  ctx: Canvas2D,
  snapshot: FrameSnapshot,
  palette: Palette,
  cache: CanvasCache,
  effects: Effects,
  pixelWidth: number,
  pixelHeight: number
) {
  const [vx, vy, vw, vh] = snapshot.box;
  const body = palette.tokens[NINA.body];

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, pixelWidth, pixelHeight);
  ctx.scale(pixelWidth / vw, pixelHeight / vh);
  ctx.translate(-vx, -vy);

  let inheritedText = palette.text;
  if (snapshot.tile !== undefined) {
    ctx.fillStyle = palette.tokens[POP[snapshot.tile]];
    ctx.fillRect(0, 0, 200, 200);
    inheritedText = palette.tokens[NINA.ink];
  }
  if (snapshot.lean !== undefined) {
    const lean = LEANS[snapshot.lean];
    ctx.translate(100 + lean.x, 200 + lean.y);
    ctx.rotate(lean.turn * DEG_TO_RAD);
    ctx.scale(lean.size, lean.size);
    ctx.translate(-102, -200);
  }
  if (snapshot.side === "left") {
    ctx.translate(204, 0);
    ctx.scale(-1, 1);
  }

  if (snapshot.mode === "whole") {
    for (const index of LEG_INDICES) {
      drawLimb(ctx, legCurve(snapshot.pose, index), LEG, 0, body);
    }
  }

  const baseState: PaintState = { alpha: 1, text: inheritedText };
  drawUpper(ctx, snapshot, palette, baseState, cache, effects);
  for (const over of snapshot.pose.above) {
    drawShape(ctx, over, palette, baseState, cache, effects);
  }
  ctx.restore();
}
