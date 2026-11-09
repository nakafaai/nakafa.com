import type { FigureAttrs } from "@nakafa/aksara-contracts/assessment/figure";
import type { InlineNode } from "@nakafa/aksara-contracts/assessment/inline";
import type { FormulaScope } from "@nakafa/aksara-contracts/math/formula/compile";
import {
  Array as Arr,
  Match,
  Option,
  pipe,
  Record as Rec,
  Schema,
} from "effect";
import {
  anchorOf,
  cornersText,
  LABELLED,
  numberOf,
  objectOf,
  type ShapeDraft,
  valueAt,
} from "@/components/tenant/exams/figure/shapes";

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
export const PlaneView = Schema.Literals(["auto", "manual"]);
export type PlaneView = typeof PlaneView.Type;

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

/** The room around the objects of a fitted plane. */
const FIT_MARGIN = 1;

/** The farthest a fitted plane reaches, so a function that runs away still leaves a readable plane. */
const FIT_LIMIT = 100;

/** The samples of a function's range that the fit reads. */
const FIT_SAMPLES = 40;

/** A point the fit holds. */
type Spot = { readonly x: number; readonly y: number };

/** The points of a shape that the plane must show. */
const spotsOf = (shape: ShapeDraft, scope: FormulaScope): readonly Spot[] =>
  Option.getOrElse(
    Option.map(objectOf(shape), (object) =>
      Match.value(object).pipe(
        Match.when({ kind: "point" }, ({ at }) => [at]),
        Match.when({ kind: "marker" }, ({ x, y }) =>
          Option.getOrElse(
            Option.map(
              Option.all({ x: valueAt(x, scope, 0), y: valueAt(y, scope, 0) }),
              Arr.of
            ),
            Arr.empty
          )
        ),
        Match.when({ kind: "line" }, ({ through }) => through),
        Match.when({ kind: "ray" }, ({ from, through }) => [from, through]),
        Match.whenOr({ kind: "segment" }, { kind: "vector" }, ({ from, to }) => [
          from,
          to,
        ]),
        Match.when({ kind: "polygon" }, ({ vertices }) => vertices),
        Match.whenOr({ kind: "circle" }, { kind: "arc" }, ({ center, radius }) => [
          { x: center.x - radius, y: center.y - radius },
          { x: center.x + radius, y: center.y + radius },
        ]),
        Match.when({ kind: "function" }, ({ domain, formula }) =>
          Arr.filterMap(Arr.range(0, FIT_SAMPLES), (step) => {
            const x =
              domain.min + ((domain.max - domain.min) * step) / FIT_SAMPLES;
            return Option.map(valueAt(formula, scope, x), (y) => ({ x, y }));
          })
        ),
        Match.orElse(() => [])
      )
    ),
    Arr.empty
  );

/** The range of one axis around its values and the origin, with room on both sides. */
const axisAround = (values: readonly number[]) => {
  const low = Math.max(Math.min(0, ...values), -FIT_LIMIT);
  const high = Math.min(Math.max(0, ...values), FIT_LIMIT);
  return {
    max: Math.ceil(high + FIT_MARGIN),
    min: Math.floor(low - FIT_MARGIN),
  };
};

/** The frame that holds every object of the plane, its labels, and the origin. */
const fitFrame = (spots: readonly Spot[]) => ({
  kind: "cartesian",
  x: axisAround(Arr.map(spots, ({ x }) => x)),
  y: axisAround(Arr.map(spots, ({ y }) => y)),
});

/** The plane of a graph: the objects, the sliders, and the range it shows. */
export type Plane = {
  readonly shapes: readonly ShapeDraft[];
  readonly sliders: readonly SliderDraft[];
  readonly view: PlaneView;
  readonly xMax: string;
  readonly xMin: string;
  readonly yMax: string;
  readonly yMin: string;
};

/** A rich label of LaTeX, as a scene anchors it. */
const mathLabel = (latex: string) => [
  { attrs: { latex }, type: "mathInline" },
];

/**
 * The scene of a plane and the rich labels it anchors, or none while a number of an object or a
 * slider is missing, or the plane holds nothing. The contract checks the rest when it reads it.
 */
export const sceneOf = (plane: Plane) =>
  Option.flatMap(
    Option.all({
      objects: Option.all(
        Arr.map(plane.shapes, (shape) =>
          Option.map(objectOf(shape), (object) => ({
            ...object,
            appearance: shape.appearance,
            id: shape.id,
          }))
        )
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
      const anchors = Arr.filterMap(plane.shapes, (shape) =>
        shape.label.trim() === "" || !Arr.contains(LABELLED, shape.kind)
          ? Option.none()
          : Option.map(anchorOf(shape, scope), (anchor) => ({
              ...anchor,
              key: shape.id,
              latex: shape.label.trim(),
              objectId: shape.id,
            }))
      );
      const frame =
        plane.view === "auto"
          ? Option.some(
              fitFrame([
                ...Arr.flatMap(plane.shapes, (shape) => spotsOf(shape, scope)),
                ...Arr.filterMap(anchors, ({ at }) =>
                  typeof at.x === "number" && typeof at.y === "number"
                    ? Option.some({ x: at.x, y: at.y })
                    : Option.none()
                ),
              ])
            )
          : Option.map(
              Option.all({
                x: Option.all({
                  max: numberOf(plane.xMax),
                  min: numberOf(plane.xMin),
                }),
                y: Option.all({
                  max: numberOf(plane.yMax),
                  min: numberOf(plane.yMin),
                }),
              }),
              (axes) => ({ ...axes, kind: "cartesian" })
            );
      return Option.map(frame, (fitted) => ({
        labels: Rec.fromEntries(
          Arr.map(anchors, ({ key, latex }) => [key, mathLabel(latex)] as const)
        ),
        scene: {
          frame: fitted,
          ...(Arr.isReadonlyArrayNonEmpty(anchors)
            ? {
                labels: Arr.map(anchors, ({ at, key, objectId, placement }) => ({
                  at,
                  key,
                  objectId,
                  placement,
                })),
              }
            : {}),
          objects,
          ...(Arr.isReadonlyArrayNonEmpty(parameters) ? { parameters } : {}),
          space: "plane",
          view: { kind: "fit" },
        },
      }));
    }
  );

/** A scene of a MathVisual figure. */
type Visual = Extract<FigureAttrs, { readonly component: "MathVisual" }>;

/** One object of a plane scene. */
type PlaneObject = Extract<
  Visual["props"]["scene"],
  { readonly space: "plane" }
>["objects"][number];

/** The LaTeX of a rich label: its formula, or its words as text. */
const latexOf = (nodes: readonly InlineNode[]) =>
  Arr.join(
    Arr.map(nodes, (node) =>
      Match.value(node).pipe(
        Match.when({ type: "mathInline" }, ({ attrs }) => attrs.latex),
        Match.when({ type: "text" }, ({ text }) => `\\text{${text}}`),
        Match.orElse(() => "")
      )
    ),
    ""
  );

/** The fields of a stored object as the builder holds them, or none for a kind the builder does not write. */
const fieldsOf = (
  object: PlaneObject
): Option.Option<Partial<ShapeDraft> & Pick<ShapeDraft, "kind">> =>
  Match.value(object).pipe(
    Match.when({ kind: "point" }, ({ at }) =>
      Option.some({ kind: "point" as const, x: String(at.x), y: String(at.y) })
    ),
    Match.when({ kind: "marker" }, ({ x, y }) =>
      Option.some({ kind: "point" as const, x, y })
    ),
    Match.whenOr({ kind: "segment" }, { kind: "vector" }, ({ from, kind, to }) =>
      Option.some({
        kind,
        x: String(from.x),
        x2: String(to.x),
        y: String(from.y),
        y2: String(to.y),
      })
    ),
    Match.when({ kind: "line" }, ({ through: [from, to] }) =>
      Option.some({
        kind: "line" as const,
        x: String(from.x),
        x2: String(to.x),
        y: String(from.y),
        y2: String(to.y),
      })
    ),
    Match.when({ kind: "ray" }, ({ from, through }) =>
      Option.some({
        kind: "ray" as const,
        x: String(from.x),
        x2: String(through.x),
        y: String(from.y),
        y2: String(through.y),
      })
    ),
    Match.when({ kind: "polygon" }, ({ vertices }) =>
      Option.some({ formula: cornersText(vertices), kind: "polygon" as const })
    ),
    Match.when({ kind: "circle" }, ({ center, radius }) =>
      Option.some({
        kind: "circle" as const,
        r: String(radius),
        x: String(center.x),
        y: String(center.y),
      })
    ),
    Match.when({ kind: "arc" }, (arc) =>
      Option.some({
        from: String(arc.startDegrees),
        kind: "angle" as const,
        r: String(arc.radius),
        to: String(arc.startDegrees + arc.sweepDegrees),
        x: String(arc.center.x),
        y: String(arc.center.y),
      })
    ),
    Match.when({ kind: "function" }, ({ domain, formula, inputAxis }) =>
      inputAxis === "y" || domain === undefined
        ? Option.none()
        : Option.some({
            formula,
            from: String(domain.min),
            kind: "function" as const,
            to: String(domain.max),
          })
    ),
    Match.when({ kind: "quadratic" }, ({ coefficients, domain, inputAxis }) =>
      inputAxis === "y"
        ? Option.none()
        : Option.some({
            formula: `${coefficients.a}*x^2 + ${coefficients.b}*x + ${coefficients.c}`,
            from: String(domain.min),
            kind: "function" as const,
            to: String(domain.max),
          })
    ),
    Match.when({ kind: "implicit" }, ({ equation }) =>
      Option.some({ formula: equation, kind: "equation" as const })
    ),
    Match.when({ kind: "region" }, ({ inequalities }) =>
      Option.some({
        formula: Arr.join(inequalities, "\n"),
        kind: "region" as const,
      })
    ),
    Match.orElse(() => Option.none())
  );

/**
 * The plane of a stored MathVisual figure, so the teacher edits what stands there, at the range it
 * shows. A space scene, readouts, or an object the builder does not write gives none, and the
 * figure can only be removed.
 */
export const planeOf = (visual: Visual): Option.Option<Plane> => {
  const { labels, scene } = visual.props;
  if (scene.space !== "plane" || (scene.readouts ?? []).length > 0) {
    return Option.none();
  }
  return Option.map(
    Option.all(
      Arr.map(scene.objects, (object) =>
        Option.map(fieldsOf(object), (fields) => ({
          ...fields,
          appearance: object.appearance,
          formula: fields.formula ?? "",
          from: fields.from ?? "",
          id: object.id,
          label: pipe(
            Arr.findFirst(scene.labels ?? [], ({ objectId }) => objectId === object.id),
            Option.flatMap(({ key }) => Rec.get(labels, key)),
            Option.match({ onNone: () => "", onSome: latexOf })
          ),
          r: fields.r ?? "",
          to: fields.to ?? "",
          x: fields.x ?? "",
          x2: fields.x2 ?? "",
          y: fields.y ?? "",
          y2: fields.y2 ?? "",
        }))
      )
    ),
    (shapes) => ({
      shapes,
      sliders: Arr.map(scene.parameters ?? [], (parameter) => ({
        id: parameter.name,
        max: String(parameter.max),
        min: String(parameter.min),
        name: parameter.name,
        step: parameter.step === undefined ? "" : String(parameter.step),
        value: String(parameter.value),
      })),
      view: "manual",
      xMax: String(scene.frame.x.max),
      xMin: String(scene.frame.x.min),
      yMax: String(scene.frame.y.max),
      yMin: String(scene.frame.y.min),
    })
  );
};
