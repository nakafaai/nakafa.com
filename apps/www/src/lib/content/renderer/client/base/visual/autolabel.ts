import {
  MathAppearanceSchema,
  SpacePointSchema,
} from "@nakafa/aksara-contracts/math/base";
import type { CoordinateFrame } from "@repo/design-system/components/three/frame";
import { Array as Arr, HashSet, Option, Schema } from "effect";
import type {
  AutoLabelBox,
  CurveSegment,
} from "@/lib/content/renderer/client/base/visual/clearance";
import {
  AutoLabelBoxSchema,
  boxAxisDistance,
  boxEdgeMargin,
  boxGap,
  clipSegmentRange,
  insetBounds,
  minSegmentDistance,
  ZERO_TOLERANCE,
} from "@/lib/content/renderer/client/base/visual/clearance";
import type { FormulaShape } from "@/lib/content/renderer/client/base/visual/formula";
import { describePlaneObjectLatex } from "@/lib/content/renderer/client/base/visual/latex";
import type {
  PlaneVisual,
  SpacePoint,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";

const AutoLabelPlacementSchema = Schema.Literals([
  "above",
  "above-left",
  "above-right",
  "below",
  "below-left",
  "below-right",
  "left",
  "right",
]);
type AutoLabelPlacement = typeof AutoLabelPlacementSchema.Type;

const AutoCurveLabelSchema = Schema.Struct({
  appearance: MathAppearanceSchema,
  at: SpacePointSchema,
  key: Schema.String,
  latex: Schema.String,
  placement: AutoLabelPlacementSchema,
});
type AutoCurveLabel = typeof AutoCurveLabelSchema.Type;

const CurvePolylineSchema = Schema.Struct({
  id: Schema.String,
  points: Schema.Array(SpacePointSchema),
});
type CurvePolyline = typeof CurvePolylineSchema.Type;

const AnchorChoiceSchema = Schema.Struct({
  at: SpacePointSchema,
  box: AutoLabelBoxSchema,
  placement: AutoLabelPlacementSchema,
});
type AnchorChoice = typeof AnchorChoiceSchema.Type;

const AutoLabelAccSchema = Schema.Struct({
  occupied: Schema.Array(AutoLabelBoxSchema),
  results: Schema.Array(AutoCurveLabelSchema),
});
type AutoLabelAcc = typeof AutoLabelAccSchema.Type;

const CandidateScoreSchema = Schema.Struct({
  at: SpacePointSchema,
  box: AutoLabelBoxSchema,
  placement: AutoLabelPlacementSchema,
  score: Schema.Finite,
});
type CandidateScore = typeof CandidateScoreSchema.Type;

const CANDIDATE_SAMPLES = 15;
const MAX_CURVE_POINTS = 24;

const PLACEMENT_ANCHOR: Readonly<
  Record<AutoLabelPlacement, readonly [number, number]>
> = {
  above: [0, 1],
  "above-left": [-1, 1],
  "above-right": [1, 1],
  below: [0, -1],
  "below-left": [-1, -1],
  "below-right": [1, -1],
  left: [-1, 0],
  right: [1, 0],
};

/** Collects sampled curve polylines from static geometry paths and formula shapes. */
export function collectCurvePolylines(
  paths: readonly CurvePolyline[],
  shapes: readonly FormulaShape[]
): readonly CurvePolyline[] {
  const formulaCurves = Arr.flatMap(shapes, (shape) =>
    shape.kind === "curve" ? [{ id: shape.id, points: shape.points }] : []
  );
  return [...paths, ...formulaCurves];
}

function belongsToObject(polylineId: string, objectId: string): boolean {
  return polylineId === objectId || polylineId.startsWith(`${objectId}:part:`);
}

function clipSegmentToInsetBox(
  a: SpacePoint,
  b: SpacePoint,
  box: CoordinateFrame
): readonly SpacePoint[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Option.match(clipSegmentRange(a, b, insetBounds(box)), {
    onNone: () => [],
    onSome: ([t0, t1]) => {
      const steps = Math.abs(t1 - t0) < ZERO_TOLERANCE ? 1 : CANDIDATE_SAMPLES;
      return Arr.makeBy(steps, (index) => {
        const t = steps === 1 ? t0 : t0 + ((t1 - t0) * index) / (steps - 1);
        return { x: a.x + dx * t, y: a.y + dy * t, z: a.z + dz * t };
      });
    },
  });
}

function isInsideInsetBox(point: SpacePoint, box: CoordinateFrame): boolean {
  const { maxX, maxY, minX, minY } = insetBounds(box);
  return (
    point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
  );
}

function collectInteriorPoints(
  ownPoints: readonly SpacePoint[],
  focus: CoordinateFrame
): readonly SpacePoint[] {
  const direct = Arr.filter(ownPoints, (point) =>
    isInsideInsetBox(point, focus)
  );
  if (direct.length >= 2) {
    return direct;
  }
  const pairs = Arr.zip(ownPoints, Arr.drop(ownPoints, 1));
  return Arr.flatMap(pairs, ([a, b]) => clipSegmentToInsetBox(a, b, focus));
}

function sampleEvenly<T>(items: readonly T[], maxCount: number): readonly T[] {
  if (items.length <= maxCount) {
    return items;
  }
  return Arr.getSomes(
    Arr.makeBy(maxCount, (index) => {
      const pick = Math.round((index * (items.length - 1)) / (maxCount - 1));
      return Arr.get(items, pick);
    })
  );
}

function polylineToSegments(
  points: readonly SpacePoint[]
): readonly CurveSegment[] {
  const sampled = sampleEvenly(points, MAX_CURVE_POINTS);
  return Arr.zip(sampled, Arr.drop(sampled, 1));
}

function normalPlacements(
  prev: SpacePoint,
  next: SpacePoint
): readonly [AutoLabelPlacement, AutoLabelPlacement] {
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  if (Math.abs(dx) < ZERO_TOLERANCE) {
    return ["right", "left"];
  }
  if (Math.abs(dy) < ZERO_TOLERANCE) {
    return ["above", "below"];
  }
  if (dx * dy > 0) {
    return ["above-left", "below-right"];
  }
  return ["above-right", "below-left"];
}

function estimateLabelBox(
  at: SpacePoint,
  placement: AutoLabelPlacement,
  latex: string,
  scale: number
): AutoLabelBox {
  const halfW = Math.min(Math.max(latex.length * 0.0095, 0.072), 0.195) * scale;
  const halfH = 0.04 * scale;
  const gap = 0.028 * scale;
  const [ax, ay] = PLACEMENT_ANCHOR[placement];
  return {
    cx: at.x + ax * (halfW + gap),
    cy: at.y + ay * (halfH + gap),
    halfH,
    halfW,
  };
}

function scoreCandidateBox(
  box: AutoLabelBox,
  occupiedBoxes: readonly AutoLabelBox[],
  otherSegments: readonly CurveSegment[],
  ownSegments: readonly CurveSegment[],
  focus: CoordinateFrame,
  origin: SpacePoint,
  scale: number
): number {
  const labelClearance =
    occupiedBoxes.length === 0
      ? scale
      : Math.min(...Arr.map(occupiedBoxes, (other) => boxGap(box, other)));
  const otherCurveClearance = minSegmentDistance(otherSegments, box, scale);
  const ownCurveClearance = minSegmentDistance(ownSegments, box, scale);
  const axisClearance = boxAxisDistance(box, origin);
  const edgeMargin = boxEdgeMargin(box, focus);

  const labelPenalty = labelClearance < scale * 0.03 ? -scale * 8 : 0;
  const otherCurvePenalty =
    otherCurveClearance < scale * 0.025 ? -scale * 6 : 0;
  const ownCurvePenalty = ownCurveClearance < scale * 0.008 ? -scale * 3.5 : 0;
  const axisPenalty = axisClearance < scale * 0.018 ? -scale * 4.5 : 0;
  const edgePenalty = edgeMargin < 0 ? edgeMargin * 10 - scale * 2 : 0;

  return (
    Math.min(Math.max(labelClearance, 0), scale * 0.35) * 3 +
    Math.min(otherCurveClearance, scale * 0.28) * 2.5 +
    Math.min(ownCurveClearance, scale * 0.06) * 1.6 +
    Math.min(axisClearance, scale * 0.16) * 2.4 +
    Math.max(0, Math.min(edgeMargin, scale * 0.18)) * 0.8 +
    labelPenalty +
    otherCurvePenalty +
    ownCurvePenalty +
    axisPenalty +
    edgePenalty
  );
}

function pickBestAnchor(
  ownPoints: readonly SpacePoint[],
  otherSegments: readonly CurveSegment[],
  occupiedBoxes: readonly AutoLabelBox[],
  latex: string,
  focus: CoordinateFrame,
  origin: SpacePoint
): Option.Option<AnchorChoice> {
  const interior = collectInteriorPoints(ownPoints, focus);
  if (!Arr.isReadonlyArrayNonEmpty(interior)) {
    return Option.none();
  }
  const first = Arr.headNonEmpty(interior);
  const last = Arr.lastNonEmpty(interior);
  const triplets = sampleEvenly(
    Arr.zip(
      interior,
      Arr.zip([first, ...interior], [...Arr.drop(interior, 1), last])
    ),
    CANDIDATE_SAMPLES
  );
  const scale = Math.max(
    focus.x.max - focus.x.min,
    focus.y.max - focus.y.min,
    1
  );
  const ownSegments = polylineToSegments(ownPoints);

  let best: CandidateScore = {
    at: first,
    box: estimateLabelBox(first, "above", latex, scale),
    placement: "above",
    score: Number.NEGATIVE_INFINITY,
  };

  Arr.forEach(triplets, ([at, [prev, next]], orderIndex) => {
    const placements = normalPlacements(prev, next);
    const progress =
      triplets.length === 1 ? 0.5 : orderIndex / (triplets.length - 1);
    const readingBias = 1 - Math.abs(progress - 0.62) * 0.06;

    Arr.forEach(placements, (placement) => {
      const box = estimateLabelBox(at, placement, latex, scale);
      const rawScore = scoreCandidateBox(
        box,
        occupiedBoxes,
        otherSegments,
        ownSegments,
        focus,
        origin,
        scale
      );
      const score = rawScore > 0 ? rawScore * readingBias : rawScore;
      if (score > best.score) {
        best = { at, box, placement, score };
      }
    });
  });

  return Option.some({
    at: best.at,
    box: best.box,
    placement: best.placement,
  });
}

/**
 * Synthesizes clean, box-separated equation labels for every unlabeled plane
 * curve or line so learners can always distinguish plotted graphs without
 * label collisions, curve crossings, or axis overlap.
 */
export function resolveAutoCurveLabels(
  scene: PlaneVisual | SpaceVisual,
  polylines: readonly CurvePolyline[],
  authoredLabelPoints: readonly SpacePoint[],
  focus: CoordinateFrame,
  origin: SpacePoint
): readonly AutoCurveLabel[] {
  if (scene.space !== "plane") {
    return [];
  }
  const authoredOwners = HashSet.fromIterable(
    Arr.map(scene.labels ?? [], (label) => label.objectId)
  );
  const scale = Math.max(
    focus.x.max - focus.x.min,
    focus.y.max - focus.y.min,
    1
  );
  const authoredBoxes = Arr.map(authoredLabelPoints, (pt) => ({
    cx: pt.x,
    cy: pt.y,
    halfH: 0.04 * scale,
    halfW: 0.08 * scale,
  }));
  const initial: AutoLabelAcc = { occupied: authoredBoxes, results: [] };

  return Arr.reduce(scene.objects, initial, (state, object) => {
    if (HashSet.has(authoredOwners, object.id)) {
      return state;
    }
    const latexOption = describePlaneObjectLatex(object);
    if (Option.isNone(latexOption)) {
      return state;
    }
    const ownPoints = Arr.flatMap(
      Arr.filter(polylines, (line: CurvePolyline) =>
        belongsToObject(line.id, object.id)
      ),
      (line: CurvePolyline) => line.points
    );
    if (ownPoints.length < 2) {
      return state;
    }
    const otherSegments = Arr.flatMap(
      Arr.filter(
        polylines,
        (line: CurvePolyline) => !belongsToObject(line.id, object.id)
      ),
      (line: CurvePolyline) => polylineToSegments(line.points)
    );
    const chosen = pickBestAnchor(
      ownPoints,
      otherSegments,
      state.occupied,
      latexOption.value,
      focus,
      origin
    );
    if (Option.isNone(chosen)) {
      return state;
    }
    return {
      occupied: Arr.append(state.occupied, chosen.value.box),
      results: Arr.append(state.results, {
        appearance: object.appearance,
        at: chosen.value.at,
        key: `auto:${object.id}`,
        latex: latexOption.value,
        placement: chosen.value.placement,
      }),
    };
  }).results;
}
