import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { Switch } from "@repo/design-system/components/ui/switch";
import { Array as Arr, Option } from "effect";
import { useId } from "react";
import { useTranslations } from "use-intl";
import {
  AltField,
  FigurePreview,
  NameField,
} from "@/components/tenant/exams/figure/fields";
import { useFigure } from "@/components/tenant/exams/figure/provider";
import { AddMenu, ShapeCard } from "@/components/tenant/exams/figure/shape";
import { isNumber } from "@/components/tenant/exams/figure/shapes";
import { SliderCard } from "@/components/tenant/exams/figure/slider";

/** The objects on the plane and its sliders, each a card the teacher edits in place, over the add menu. */
function ShapeList() {
  const t = useTranslations("Exams");
  const shapes = useFigure((state) => state.draft.shapes);
  const sliders = useFigure((state) => state.draft.sliders);

  return (
    <FieldSet className="gap-3">
      <FieldLegend>{t("figure-objects")}</FieldLegend>
      {Arr.map(shapes, (shape) => (
        <ShapeCard key={shape.id} shape={shape} />
      ))}
      {Arr.map(sliders, (slider) => (
        <SliderCard key={slider.id} slider={slider} />
      ))}
      <AddMenu />
    </FieldSet>
  );
}

/** What each end of the range looks like, shown while its field is empty. */
const RANGE_EXAMPLE = {
  xMax: "5",
  xMin: "-5",
  yMax: "5",
  yMin: "-5",
} as const;

/** One end of the range the plane shows. */
function RangeInput({
  field,
  label,
}: {
  readonly field: keyof typeof RANGE_EXAMPLE;
  readonly label: string;
}) {
  const value = useFigure((state) => state.draft[field]);
  const change = useFigure((state) => state.change);
  const id = useId();

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        aria-invalid={!isNumber(value)}
        dir="ltr"
        id={id}
        inputMode="decimal"
        onChange={(event) => change({ [field]: event.target.value })}
        placeholder={RANGE_EXAMPLE[field]}
        value={value}
      />
    </Field>
  );
}

/**
 * The range the plane shows: fitted around its objects and the origin, or the range the teacher types, which
 * starts from the fitted one.
 */
function ViewFields() {
  const t = useTranslations("Exams");
  const view = useFigure((state) => state.draft.view);
  const figure = useFigure((state) => state.figure);
  const change = useFigure((state) => state.change);
  const id = useId();

  /** Keeps the range the plane shows now, so typing starts from what the teacher sees. */
  const fit = (auto: boolean) => {
    if (auto) {
      change({ view: "auto" });
      return;
    }
    const frame = Option.flatMap(figure, (attrs) =>
      attrs.component === "MathVisual" && attrs.props.scene.space === "plane"
        ? Option.some(attrs.props.scene.frame)
        : Option.none()
    );
    change({
      view: "manual",
      ...Option.match(frame, {
        onNone: () => ({}),
        onSome: ({ x, y }) => ({
          xMax: String(x.max),
          xMin: String(x.min),
          yMax: String(y.max),
          yMin: String(y.min),
        }),
      }),
    });
  };

  return (
    <FieldSet className="gap-3">
      <Field orientation="horizontal">
        <Switch checked={view === "auto"} id={id} onCheckedChange={fit} />
        <FieldLabel htmlFor={id}>{t("figure-fit")}</FieldLabel>
      </Field>
      {view === "manual" ? (
        <div className="grid grid-cols-2 gap-3">
          <RangeInput field="xMin" label={t("figure-from")} />
          <RangeInput field="xMax" label={t("figure-to")} />
          <RangeInput field="yMin" label={t("figure-from-y")} />
          <RangeInput field="yMax" label={t("figure-to-y")} />
        </div>
      ) : null}
    </FieldSet>
  );
}

/**
 * The builder of a graph: the plane as the student reads it beside the objects on it. A teacher adds points,
 * segments, lines, rays, vectors, polygons, circles, angles, functions, equations, regions and sliders, edits each
 * one where it stands, and sees the plane follow every keystroke.
 */
export function GraphBuilder() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <FigurePreview />
      <FieldGroup>
        <NameField />
        <ShapeList />
        <ViewFields />
        <AltField />
      </FieldGroup>
    </div>
  );
}
