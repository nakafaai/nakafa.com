import type { FigureAttrs } from "@nakafa/aksara-contracts/assessment/figure";
import { Array as Arr, Match, Option, pipe, Record as Rec } from "effect";
import type { Plane } from "@/components/tenant/exams/figure/plane";
import {
  cornersText,
  newShape,
  type ShapeDraft,
} from "@/components/tenant/exams/figure/shapes";
import { spaceFieldsOf } from "@/components/tenant/exams/figure/space";

/** A scene of a MathVisual figure. */
type Visual = Extract<FigureAttrs, { readonly component: "MathVisual" }>;

/** One object of a plane scene. */
type PlaneObject = Extract<
  Visual["props"]["scene"],
  { readonly space: "plane" }
>["objects"][number];

/** The LaTeX of a rich label: its formulas, and its words as text. */
const latexOf = (nodes: Visual["props"]["labels"][string]) =>
  Arr.join(
    Arr.map(nodes, (node) =>
      node.type === "mathInline" ? node.attrs.latex : `\\text{${node.text}}`
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
    Match.whenOr(
      { kind: "segment" },
      { kind: "vector" },
      ({ from, kind, to }) =>
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

/** A scene of a stored MathVisual figure, on a plane or in space. */
type Scene = Visual["props"]["scene"];

/** One label anchor of a stored scene. */
type SceneAnchor = NonNullable<Scene["labels"]>[number];

/** The fields of a stored object, beside the object they came from. */
const readOf = <Object extends { readonly id: string }>(
  object: Object,
  read: Option.Option<Partial<ShapeDraft> & Pick<ShapeDraft, "kind">>
) => Option.map(read, (fields) => ({ fields, object }));

/**
 * The graph of a stored MathVisual figure, so the teacher edits what stands there, at the range it shows: a
 * plane, or space with its z range. Readouts, or an object the builder does not write, give none, and the
 * figure can only be removed.
 */
export const planeOf = (visual: Visual): Option.Option<Plane> => {
  const { labels, scene } = visual.props;
  if ((scene.readouts ?? []).length > 0) {
    return Option.none();
  }
  const anchors: readonly SceneAnchor[] = scene.labels ?? [];
  const read =
    scene.space === "space"
      ? Arr.map(scene.objects, (object) =>
          readOf(object, spaceFieldsOf(object))
        )
      : Arr.map(scene.objects, (object) => readOf(object, fieldsOf(object)));
  return Option.map(Option.all(read), (objects) => ({
    shapes: Arr.map(objects, ({ fields, object }) => ({
      ...newShape(fields.kind, object.id, 0),
      ...fields,
      appearance: object.appearance,
      label: pipe(
        Arr.findFirst(anchors, ({ objectId }) => objectId === object.id),
        Option.flatMap(({ key }) => Rec.get(labels, key)),
        Option.match({ onNone: () => "", onSome: latexOf })
      ),
    })),
    sliders: Arr.map(scene.parameters ?? [], (parameter) => ({
      id: parameter.name,
      max: String(parameter.max),
      min: String(parameter.min),
      name: parameter.name,
      step: parameter.step === undefined ? "" : String(parameter.step),
      value: String(parameter.value),
    })),
    space: scene.space,
    view: "manual",
    xMax: String(scene.frame.x.max),
    xMin: String(scene.frame.x.min),
    yMax: String(scene.frame.y.max),
    yMin: String(scene.frame.y.min),
    ...(scene.space === "space"
      ? { zMax: String(scene.frame.z.max), zMin: String(scene.frame.z.min) }
      : { zMax: "5", zMin: "-5" }),
  }));
};
