import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Match } from "effect";
import { useId } from "react";
import { useTranslations } from "use-intl";
import { useFigure } from "@/components/tenant/exams/figure/provider";
import {
  isEquation,
  isFormula,
  isInequalities,
  isNumber,
  type ShapeDraft,
} from "@/components/tenant/exams/figure/shapes";

/** The fields of a shape that hold one line of text. */
type LineField = "from" | "r" | "to" | "x" | "x2" | "y" | "y2" | "z" | "z2";

/** One field of an object: a number by default, or a formula where the kind reads one. */
function ShapeInput({
  check = isNumber,
  field,
  label,
  placeholder = "0",
  shape,
}: {
  readonly check?: (text: string) => boolean;
  readonly field: LineField | "formula";
  readonly label: string;
  readonly placeholder?: string;
  readonly shape: ShapeDraft;
}) {
  const changeShape = useFigure((state) => state.changeShape);
  const id = useId();
  const value = shape[field];

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        aria-invalid={!check(value)}
        dir="ltr"
        id={id}
        inputMode={check === isNumber ? "decimal" : "text"}
        onChange={(event) =>
          changeShape(shape.id, { [field]: event.target.value })
        }
        placeholder={placeholder}
        value={value}
      />
    </Field>
  );
}

/** A number or a formula of the sliders, as a point's coordinates may be. */
const isCoordinate = (text: string) => isNumber(text) || isFormula(text);

/** The fields that place an object in space: a point and the ends of a segment take z, a function draws z = f(x, y). */
export function SpacePlace({ shape }: { readonly shape: ShapeDraft }) {
  const t = useTranslations("Exams");

  return Match.value(shape.kind).pipe(
    Match.when("point", () => (
      <div className="grid grid-cols-3 gap-3">
        <ShapeInput field="x" label="x" shape={shape} />
        <ShapeInput field="y" label="y" shape={shape} />
        <ShapeInput field="z" label="z" shape={shape} />
      </div>
    )),
    Match.when("function", () => (
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <ShapeInput
            check={isFormula}
            field="formula"
            label="f(x, y) ="
            placeholder="x^2 - y^2"
            shape={shape}
          />
        </div>
        <ShapeInput field="from" label={t("figure-from")} shape={shape} />
        <ShapeInput field="to" label={t("figure-to")} shape={shape} />
      </div>
    )),
    Match.orElse(() => (
      <div className="grid grid-cols-3 gap-3">
        <ShapeInput field="x" label="x₁" shape={shape} />
        <ShapeInput field="y" label="y₁" shape={shape} />
        <ShapeInput field="z" label="z₁" shape={shape} />
        <ShapeInput field="x2" label="x₂" shape={shape} />
        <ShapeInput field="y2" label="y₂" shape={shape} />
        <ShapeInput field="z2" label="z₂" shape={shape} />
      </div>
    ))
  );
}

/** The fields that place an object on a plane, by its kind. */
export function PlanePlace({ shape }: { readonly shape: ShapeDraft }) {
  const t = useTranslations("Exams");
  const changeShape = useFigure((state) => state.changeShape);
  const id = useId();

  return Match.value(shape.kind).pipe(
    Match.when("point", () => (
      <div className="grid grid-cols-2 gap-3">
        <ShapeInput check={isCoordinate} field="x" label="x" shape={shape} />
        <ShapeInput check={isCoordinate} field="y" label="y" shape={shape} />
      </div>
    )),
    Match.whenOr("segment", "line", "ray", "vector", () => (
      <div className="grid grid-cols-2 gap-3">
        <ShapeInput field="x" label="x₁" shape={shape} />
        <ShapeInput field="y" label="y₁" shape={shape} />
        <ShapeInput field="x2" label="x₂" shape={shape} />
        <ShapeInput field="y2" label="y₂" shape={shape} />
      </div>
    )),
    Match.when("circle", () => (
      <div className="grid grid-cols-3 gap-3">
        <ShapeInput field="x" label="x" shape={shape} />
        <ShapeInput field="y" label="y" shape={shape} />
        <ShapeInput field="r" label="r" shape={shape} />
      </div>
    )),
    Match.when("angle", () => (
      <div className="grid grid-cols-3 gap-3">
        <ShapeInput field="x" label="x" shape={shape} />
        <ShapeInput field="y" label="y" shape={shape} />
        <ShapeInput field="r" label="r" shape={shape} />
        <ShapeInput field="from" label={t("figure-angle-from")} shape={shape} />
        <ShapeInput field="to" label={t("figure-angle-to")} shape={shape} />
      </div>
    )),
    Match.when("function", () => (
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <ShapeInput
            check={isFormula}
            field="formula"
            label="f(x) ="
            placeholder="a x^2 + 1"
            shape={shape}
          />
        </div>
        <ShapeInput field="from" label={t("figure-from")} shape={shape} />
        <ShapeInput field="to" label={t("figure-to")} shape={shape} />
      </div>
    )),
    Match.when("equation", () => (
      <ShapeInput
        check={isEquation}
        field="formula"
        label={t("figure-equation")}
        placeholder="x^2 + y^2 = 4"
        shape={shape}
      />
    )),
    Match.whenOr("polygon", "region", (kind) => (
      <Field>
        <FieldLabel htmlFor={id}>
          {t(kind === "polygon" ? "figure-corners" : "figure-inequalities")}
        </FieldLabel>
        <Textarea
          aria-invalid={
            kind === "region"
              ? !isInequalities(shape.formula)
              : shape.formula.trim() === ""
          }
          className="min-h-16 font-mono"
          dir="ltr"
          id={id}
          onChange={(event) =>
            changeShape(shape.id, { formula: event.target.value })
          }
          placeholder={kind === "polygon" ? "(0, 0) (4, 0) (0, 3)" : "y >= x^2"}
          value={shape.formula}
        />
        <FieldDescription>
          {t(
            kind === "polygon"
              ? "figure-corners-hint"
              : "figure-inequalities-hint"
          )}
        </FieldDescription>
      </Field>
    )),
    Match.exhaustive
  );
}
