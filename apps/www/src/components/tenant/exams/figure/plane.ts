import type { SpacePoint } from "@nakafa/aksara-contracts/math/base";
import type { FormulaScope } from "@nakafa/aksara-contracts/math/formula/compile";
import { Array as Arr, Option, Record as Rec, Schema } from "effect";
import {
  anchorOf,
  objectOf,
  planeSpotsOf,
} from "@/components/tenant/exams/figure/object";
import {
  LABELLED,
  numberOf,
  ShapeDraft,
} from "@/components/tenant/exams/figure/shapes";
import {
  spaceAnchorOf,
  spaceObjectOf,
  spaceSpotsOf,
} from "@/components/tenant/exams/figure/space";

/** One slider as its fields hold it: the letter formulas read, its range, its first value, and its step. */
export const SliderDraft = Schema.Struct({
  id: Schema.String,
  max: Schema.String,
  min: Schema.String,
  name: Schema.String,
  step: Schema.String,
  value: Schema.String,
});
export type SliderDraft = typeof SliderDraft.Type;

/** Whether the plane fits itself around its objects, or keeps the range the teacher typed. */
const PlaneView = Schema.Literals(["auto", "manual"]);

/** A new slider named by the next free letter of the ones formulas may read. */
export const newSlider = (id: string, name: string): SliderDraft => ({
  id,
  max: "5",
  min: "-5",
  name,
  step: "0.1",
  value: "1",
});

/** The letters a slider may take, in order: x, y, t, u, v, z and e are read otherwise. */
const SLIDER_NAMES = Arr.fromIterable("abcdfghjkmnpqrsw");

/** The first letter no slider holds yet, or none when all of them are taken. */
export const freeName = (sliders: readonly SliderDraft[]) =>
  Arr.findFirst(
    SLIDER_NAMES,
    (name) => !Arr.some(sliders, (slider) => slider.name === name)
  );

/** The parameters of the sliders, or none while one of their numbers is missing. */
const parametersOf = (sliders: readonly SliderDraft[]) =>
  Option.all(
    Arr.map(sliders, (slider) =>
      Option.map(
        Option.all({
          max: numberOf(slider.max),
          min: numberOf(slider.min),
          value: numberOf(slider.value),
        }),
        (range) => ({
          ...range,
          name: slider.name,
          ...Option.match(numberOf(slider.step), {
            onNone: () => ({}),
            onSome: (step) => ({ step }),
          }),
        })
      )
    )
  );

/** The room around the objects of a fitted frame. */
const FIT_MARGIN = 1;

/** The farthest a fitted frame reaches, so a function that runs away still leaves a readable graph. */
const FIT_LIMIT = 100;

/** The range of one axis around its values and the origin, with room on both sides. */
const axisAround = (values: readonly number[]) => {
  const low = Math.max(Math.min(0, ...values), -FIT_LIMIT);
  const high = Math.min(Math.max(0, ...values), FIT_LIMIT);
  return {
    max: Math.ceil(high + FIT_MARGIN),
    min: Math.floor(low - FIT_MARGIN),
  };
};

/** A range a teacher typed, or none while one of its ends is no number. */
const rangeOf = (min: string, max: string) =>
  Option.all({ max: numberOf(max), min: numberOf(min) });

/**
 * The graph as its fields hold it: the objects, the sliders, whether it is a plane or space, and the range it
 * shows.
 */
export const PlaneDraft = Schema.Struct({
  shapes: Schema.Array(ShapeDraft),
  sliders: Schema.Array(SliderDraft),
  space: Schema.Literals(["plane", "space"]),
  view: PlaneView,
  xMax: Schema.String,
  xMin: Schema.String,
  yMax: Schema.String,
  yMin: Schema.String,
  zMax: Schema.String,
  zMin: Schema.String,
});
export type Plane = typeof PlaneDraft.Type;

/** A rich label of LaTeX, as a scene anchors it. */
const mathLabel = (latex: string) => [{ attrs: { latex }, type: "mathInline" }];

/** The object of a shape in the graph's dimension, with its id and role. */
const placedOf = (plane: Plane, shape: ShapeDraft) =>
  Option.map(
    plane.space === "space" ? spaceObjectOf(shape) : objectOf(shape),
    (object) => ({ ...object, appearance: shape.appearance, id: shape.id })
  );

/** Where the label of a shape stands in the graph's dimension, or none for a shape with no label or no place. */
const anchorAt = (plane: Plane, shape: ShapeDraft, scope: FormulaScope) =>
  shape.label.trim() === "" || !Arr.contains(LABELLED, shape.kind)
    ? Option.none()
    : Option.map(
        plane.space === "space"
          ? Option.map(spaceAnchorOf(shape), (at) => ({
              at,
              placement: "above-right" as const,
            }))
          : anchorOf(shape, scope),
        (anchor) => ({
          ...anchor,
          key: shape.id,
          latex: shape.label.trim(),
          objectId: shape.id,
        })
      );

/** The frame that holds every object of the graph, its labels, and the origin, or the range the teacher typed. */
const frameOf = (
  plane: Plane,
  scope: FormulaScope,
  labelled: readonly SpacePoint[]
) => {
  if (plane.view === "manual") {
    return Option.map(
      Option.all({
        x: rangeOf(plane.xMin, plane.xMax),
        y: rangeOf(plane.yMin, plane.yMax),
        ...(plane.space === "space"
          ? { z: rangeOf(plane.zMin, plane.zMax) }
          : {}),
      }),
      (axes) => ({ ...axes, kind: "cartesian" })
    );
  }
  const spots = [
    ...Arr.flatMap(plane.shapes, (shape) =>
      plane.space === "space"
        ? spaceSpotsOf(shape, scope)
        : Arr.map(planeSpotsOf(shape, scope), (spot) => ({ ...spot, z: 0 }))
    ),
    ...labelled,
  ];
  return Option.some({
    kind: "cartesian",
    x: axisAround(Arr.map(spots, ({ x }) => x)),
    y: axisAround(Arr.map(spots, ({ y }) => y)),
    ...(plane.space === "space"
      ? { z: axisAround(Arr.map(spots, ({ z }) => z)) }
      : {}),
  });
};

/**
 * The scene of a graph and the rich labels it anchors, or none while a number of an object or a slider is
 * missing, or the graph holds nothing. A plane fits its view; space looks from the isometric corner. The
 * contract checks the rest when it reads it.
 */
export const sceneOf = (plane: Plane) =>
  Option.flatMap(
    Option.all({
      objects: Option.all(
        Arr.map(plane.shapes, (shape) => placedOf(plane, shape))
      ),
      parameters: parametersOf(plane.sliders),
    }),
    ({ objects, parameters }) => {
      if (!Arr.isReadonlyArrayNonEmpty(objects)) {
        return Option.none();
      }
      const scope: FormulaScope = Rec.fromEntries(
        Arr.map(parameters, ({ name, value }) => [name, value] as const)
      );
      const anchors = Arr.getSomes(
        Arr.map(plane.shapes, (shape) => anchorAt(plane, shape, scope))
      );
      const labelled = Arr.flatMap(anchors, ({ at }) =>
        typeof at.x === "number" && typeof at.y === "number"
          ? [{ x: at.x, y: at.y, z: "z" in at ? at.z : 0 }]
          : []
      );
      return Option.map(frameOf(plane, scope, labelled), (frame) => ({
        labels: Rec.fromEntries(
          Arr.map(anchors, ({ key, latex }) => [key, mathLabel(latex)] as const)
        ),
        scene: {
          frame,
          ...(Arr.isReadonlyArrayNonEmpty(anchors)
            ? {
                labels: Arr.map(
                  anchors,
                  ({ at, key, objectId, placement }) => ({
                    at,
                    key,
                    objectId,
                    placement,
                  })
                ),
              }
            : {}),
          objects,
          ...(Arr.isReadonlyArrayNonEmpty(parameters) ? { parameters } : {}),
          space: plane.space,
          view: { kind: plane.space === "space" ? "isometric" : "fit" },
        },
      }));
    }
  );
