import type { ARM } from "@repo/mascot/nina/body";
import type { Curve } from "@repo/mascot/nina/limb";
import { edges } from "@repo/mascot/nina/limb";
import type { Mark } from "@repo/mascot/nina/mark";
import type { Shape } from "@repo/mascot/shape";
import {
  Array as Arr,
  Match,
  MutableHashMap,
  Option,
  Record as Rec,
  Result,
  Schema,
  String as Str,
} from "effect";

const SVG_NS = "http://www.w3.org/2000/svg";
export const DEG_TO_RAD = Math.PI / 180;
const TRANSFORM_PART = /(?<kind>[a-z]+)\((?<raw>[^)]*)\)/gu;
const SEPARATOR = /[\s,]+/u;

const PaletteSchema = Schema.Struct({
  text: Schema.String,
  tokens: Schema.Record(Schema.String, Schema.String),
});

export type Palette = typeof PaletteSchema.Type;

const EffectsSchema = Schema.Struct({
  eyeScaleY: Schema.Finite,
  heldPop: Schema.Finite,
});

export type Effects = typeof EffectsSchema.Type;

const PaintStateSchema = Schema.Struct({
  alpha: Schema.Finite,
  text: Schema.String,
});

export type PaintState = typeof PaintStateSchema.Type;
type LeafShape = Exclude<Shape<Mark>, { readonly _tag: "g" }>;

/** The 2D canvas operations Nina's renderer uses. */
export type Canvas2D = Pick<
  CanvasRenderingContext2D,
  | "arc"
  | "beginPath"
  | "clearRect"
  | "closePath"
  | "ellipse"
  | "fill"
  | "fillRect"
  | "fillStyle"
  | "globalAlpha"
  | "lineCap"
  | "lineJoin"
  | "lineTo"
  | "lineWidth"
  | "moveTo"
  | "quadraticCurveTo"
  | "rect"
  | "restore"
  | "rotate"
  | "roundRect"
  | "save"
  | "scale"
  | "setLineDash"
  | "setTransform"
  | "stroke"
  | "strokeStyle"
  | "translate"
>;

/** Reusable per-instance caches for static Path2D geometry and normalized path lengths. */
export function createCache() {
  return {
    lengths: MutableHashMap.empty<string, number>(),
    paths: MutableHashMap.empty<string, Path2D>(),
  };
}

export type CanvasCache = ReturnType<typeof createCache>;

/** Resolves a colour token, `currentColor`, or hex string into a Canvas fill/stroke value. */
function resolveColor(value: string, palette: Palette, inheritedText: string) {
  if (value === "currentColor") {
    return inheritedText;
  }
  return Rec.get(palette.tokens, value).pipe(Option.getOrElse(() => value));
}

/** Parses whitespace- or comma-separated numbers from an SVG attribute value. */
function numbersOf(raw: string): readonly number[] {
  return Arr.filterMap(Str.split(Str.trim(raw), SEPARATOR), (token) => {
    const parsed = Number(token);
    return token !== "" && Number.isFinite(parsed)
      ? Result.succeed(parsed)
      : Result.failVoid;
  });
}

/** Applies an SVG `transform` string (`translate`, `rotate`, `scale`) to a 2D canvas context. */
export function applyTransform(ctx: Canvas2D, transform: string) {
  for (const match of transform.matchAll(TRANSFORM_PART)) {
    const args = numbersOf(match[2]);
    Match.value(match[1]).pipe(
      Match.when("translate", () => {
        ctx.translate(args[0] ?? 0, args[1] ?? 0);
      }),
      Match.when("rotate", () => {
        const angle = (args[0] ?? 0) * DEG_TO_RAD;
        if (args.length >= 3) {
          ctx.translate(args[1], args[2]);
          ctx.rotate(angle);
          ctx.translate(-args[1], -args[2]);
        } else {
          ctx.rotate(angle);
        }
      }),
      Match.when("scale", () => {
        const sx = args[0] ?? 1;
        ctx.scale(sx, args[1] ?? sx);
      }),
      Match.orElse(() => undefined)
    );
  }
}

/** Looks up or builds a cached `Path2D` for a static SVG path string. */
export function cachedPath(cache: CanvasCache, d: string) {
  return Option.getOrElse(MutableHashMap.get(cache.paths, d), () => {
    const built = new Path2D(d);
    MutableHashMap.set(cache.paths, d, built);
    return built;
  });
}

/** Measures and caches the geometric length of an SVG path for `pathLength` dash scaling. */
function cachedLength(cache: CanvasCache, d: string) {
  return Option.getOrElse(MutableHashMap.get(cache.lengths, d), () => {
    const probe = document.createElementNS(SVG_NS, "path");
    probe.setAttribute("d", d);
    const length =
      typeof probe.getTotalLength === "function" ? probe.getTotalLength() : 0;
    MutableHashMap.set(cache.lengths, d, length);
    return length;
  });
}

/** Traces one tentacle directly from its edge points onto the canvas without building an SVG string. */
export function drawLimb(
  ctx: Canvas2D,
  curve: Curve,
  girth: typeof ARM,
  from: number,
  fill: string
) {
  const { left, right, root, tip } = edges(curve, girth, from);
  const last = left.length - 1;
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  ctx.lineTo((left[0][0] + left[1][0]) / 2, (left[0][1] + left[1][1]) / 2);
  for (let a = 1; a < last; a += 1) {
    ctx.quadraticCurveTo(
      left[a][0],
      left[a][1],
      (left[a][0] + left[a + 1][0]) / 2,
      (left[a][1] + left[a + 1][1]) / 2
    );
  }
  ctx.lineTo(left[last][0], left[last][1]);
  ctx.quadraticCurveTo(tip[0], tip[1], right[last][0], right[last][1]);
  ctx.lineTo(
    (right[last][0] + right[last - 1][0]) / 2,
    (right[last][1] + right[last - 1][1]) / 2
  );
  for (let b = last - 1; b >= 1; b -= 1) {
    ctx.quadraticCurveTo(
      right[b][0],
      right[b][1],
      (right[b][0] + right[b - 1][0]) / 2,
      (right[b][1] + right[b - 1][1]) / 2
    );
  }
  ctx.lineTo(right[0][0], right[0][1]);
  if (from === 0) {
    ctx.quadraticCurveTo(root[0], root[1], left[0][0], left[0][1]);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Computes dash lengths in path units, scaling by `totalLength / pathLength` when normalized. */
function dashOf(shape: LeafShape, cache: CanvasCache, pattern: string) {
  const raw = numbersOf(pattern);
  if (shape._tag !== "path" || shape.pathLength === undefined) {
    return raw;
  }
  const scale = cachedLength(cache, shape.d) / shape.pathLength;
  return scale > 0 ? Arr.map(raw, (segment) => segment * scale) : raw;
}

/** Fills a leaf shape when it declares a visible fill. */
function fillLeaf(
  ctx: Canvas2D,
  shape: LeafShape,
  palette: Palette,
  state: PaintState,
  alpha: number,
  built?: Path2D
) {
  if (shape.fill === undefined || shape.fill === "none") {
    return;
  }
  ctx.globalAlpha = alpha * (shape.fillOpacity ?? 1);
  ctx.fillStyle = resolveColor(shape.fill, palette, state.text);
  const rule = shape.fillRule ?? "nonzero";
  if (built === undefined) {
    ctx.fill(rule);
  } else {
    ctx.fill(built, rule);
  }
}

/** Strokes a leaf shape when it declares a visible stroke. */
function strokeLeaf(
  ctx: Canvas2D,
  shape: LeafShape,
  palette: Palette,
  state: PaintState,
  cache: CanvasCache,
  alpha: number,
  built?: Path2D
) {
  if (shape.stroke === undefined || shape.stroke === "none") {
    return;
  }
  ctx.globalAlpha = alpha * (shape.strokeOpacity ?? 1);
  ctx.strokeStyle = resolveColor(shape.stroke, palette, state.text);
  ctx.lineWidth = shape.strokeWidth ?? 1;
  ctx.lineCap = shape.strokeLinecap ?? "butt";
  ctx.lineJoin = shape.strokeLinejoin ?? "miter";
  if (shape.strokeDasharray !== undefined) {
    ctx.setLineDash([...dashOf(shape, cache, shape.strokeDasharray)]);
  }
  if (built === undefined) {
    ctx.stroke();
  } else {
    ctx.stroke(built);
  }
}

/** Paints fill and stroke of a leaf shape whose geometry is either a `Path2D` or the current subpath. */
function paintLeaf(
  ctx: Canvas2D,
  shape: LeafShape,
  palette: Palette,
  state: PaintState,
  cache: CanvasCache,
  built?: Path2D
) {
  const alpha = state.alpha * (shape.opacity ?? 1);
  fillLeaf(ctx, shape, palette, state, alpha, built);
  strokeLeaf(ctx, shape, palette, state, cache, alpha, built);
}

/** Draws one declarative shape or group onto the canvas. */
export function drawShape(
  ctx: Canvas2D,
  shape: Shape<Mark>,
  palette: Palette,
  state: PaintState,
  cache: CanvasCache,
  effects: Effects
): void {
  const nextState: PaintState = {
    alpha: state.alpha * (shape.opacity ?? 1),
    text:
      shape.color === undefined
        ? state.text
        : resolveColor(shape.color, palette, state.text),
  };

  ctx.save();
  if (shape.transform !== undefined) {
    applyTransform(ctx, shape.transform);
  }

  Match.valueTags(shape, {
    circle: (dot) => {
      ctx.beginPath();
      ctx.arc(dot.cx, dot.cy, dot.r, 0, Math.PI * 2);
      paintLeaf(ctx, dot, palette, state, cache);
    },
    ellipse: (oval) => {
      const ry =
        oval.mark?._tag === "eye" ? oval.ry * effects.eyeScaleY : oval.ry;
      ctx.beginPath();
      ctx.ellipse(oval.cx, oval.cy, oval.rx, ry, 0, 0, Math.PI * 2);
      paintLeaf(ctx, oval, palette, state, cache);
    },
    g: (groupShape) => {
      for (const child of groupShape.children) {
        drawShape(ctx, child, palette, nextState, cache, effects);
      }
    },
    path: (pathShape) => {
      paintLeaf(
        ctx,
        pathShape,
        palette,
        state,
        cache,
        cachedPath(cache, pathShape.d)
      );
    },
    polygon: (poly) => {
      const coords = numbersOf(poly.points);
      if (coords.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(coords[0], coords[1]);
        for (let i = 2; i + 1 < coords.length; i += 2) {
          ctx.lineTo(coords[i], coords[i + 1]);
        }
        ctx.closePath();
        paintLeaf(ctx, poly, palette, state, cache);
      }
    },
    rect: (box) => {
      const x = box.x ?? 0;
      const y = box.y ?? 0;
      ctx.beginPath();
      if (box.rx !== undefined && box.rx > 0) {
        ctx.roundRect(x, y, box.width, box.height, box.rx);
      } else {
        ctx.rect(x, y, box.width, box.height);
      }
      paintLeaf(ctx, box, palette, state, cache);
    },
  });

  ctx.restore();
}
