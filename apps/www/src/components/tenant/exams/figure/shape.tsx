import {
  Add01Icon,
  AngleIcon,
  ArrowRight02Icon,
  ArrowUpRight01Icon,
  CircleDotIcon,
  CircleIcon,
  Copy01Icon,
  Delete02Icon,
  EqualSignIcon,
  FunctionOfXIcon,
  LineIcon,
  LinerIcon,
  MoreHorizontalIcon,
  PolygonIcon,
  SlidersHorizontalIcon,
  SquaresIntersectIcon,
} from "@hugeicons/core-free-icons";
import { MathAppearanceSchema } from "@nakafa/aksara-contracts/math/base";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, Option, Schema } from "effect";
import { useId } from "react";
import { useTranslations } from "use-intl";
import { ShapePlace } from "@/components/tenant/exams/figure/place";
import { freeName } from "@/components/tenant/exams/figure/plane";
import { useFigure } from "@/components/tenant/exams/figure/provider";
import {
  LABELLED,
  type ShapeDraft,
  ShapeKind,
} from "@/components/tenant/exams/figure/shapes";
import { SPACE_KINDS } from "@/components/tenant/exams/figure/space";

/** The icon of each object, the same in the add menu and on its card. */
const SHAPE_ICON = {
  angle: AngleIcon,
  circle: CircleIcon,
  equation: EqualSignIcon,
  function: FunctionOfXIcon,
  line: LinerIcon,
  point: CircleDotIcon,
  polygon: PolygonIcon,
  ray: ArrowRight02Icon,
  region: SquaresIntersectIcon,
  segment: LineIcon,
  vector: ArrowUpRight01Icon,
} satisfies Record<ShapeKind, typeof AngleIcon>;

/** The name of each object. */
const SHAPE_NAME = {
  angle: "figure-angle",
  circle: "figure-circle",
  equation: "figure-equation",
  function: "figure-function",
  line: "figure-line",
  point: "figure-point",
  polygon: "figure-polygon",
  ray: "figure-ray",
  region: "figure-region",
  segment: "figure-segment",
  vector: "figure-vector",
} as const satisfies Record<ShapeKind, string>;

/** The name of each role an object takes, which the design system draws in its own way. */
const STYLE_NAME = {
  answer: "figure-answer",
  construction: "figure-construction",
  highlight: "figure-highlight",
  primary: "figure-primary",
  reference: "figure-reference",
  secondary: "figure-secondary",
  warning: "figure-warning",
} as const satisfies Record<typeof MathAppearanceSchema.Type, string>;

/** Whether a value the style select gives is one of the roles. */
const isStyle = Schema.is(MathAppearanceSchema);

/** The menu that puts a new object or a slider on the graph, drawn at once where it starts: in space, the kinds it draws in 3D. */
export function AddMenu() {
  const common = useTranslations("Common");
  const t = useTranslations("Exams");
  const addShape = useFigure((state) => state.addShape);
  const addSlider = useFigure((state) => state.addSlider);
  const space = useFigure((state) => state.draft.space === "space");
  const full = useFigure((state) =>
    Option.isNone(freeName(state.draft.sliders))
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button className="w-full" type="button" variant="outline" />}
      >
        <HugeIcons aria-hidden="true" icon={Add01Icon} />
        {t("figure-add")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" label={common("menu-insert")}>
        {Arr.map(space ? SPACE_KINDS : ShapeKind.literals, (kind) => (
          <DropdownMenuItem
            icon={SHAPE_ICON[kind]}
            key={kind}
            onClick={() => addShape(kind)}
          >
            {t(SHAPE_NAME[kind])}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem
          disabled={full}
          icon={SlidersHorizontalIcon}
          onClick={addSlider}
        >
          {t("figure-slider-add")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The menu of one object: a copy of it, and taking it away. */
function ShapeMenu({ shape }: { readonly shape: ShapeDraft }) {
  const common = useTranslations("Common");
  const t = useTranslations("Exams");
  const copyShape = useFigure((state) => state.copyShape);
  const removeShape = useFigure((state) => state.removeShape);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className="ms-auto"
            size="icon-sm"
            tooltip={common("more")}
            type="button"
            variant="ghost"
          />
        }
      >
        <HugeIcons aria-hidden="true" icon={MoreHorizontalIcon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" label={common("menu-actions")}>
        <DropdownMenuItem icon={Copy01Icon} onClick={() => copyShape(shape.id)}>
          {t("grid-duplicate")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          icon={Delete02Icon}
          onClick={() => removeShape(shape.id)}
          variant="destructive"
        >
          {common("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** One object on the plane: its kind, the fields that place it, its label, and its role. */
export function ShapeCard({ shape }: { readonly shape: ShapeDraft }) {
  const editor = useTranslations("Editor");
  const t = useTranslations("Exams");
  const changeShape = useFigure((state) => state.changeShape);
  const id = useId();

  return (
    <FieldSet className="gap-3 rounded-lg border p-3">
      <FieldLegend className="flex w-full items-center gap-2" variant="label">
        <HugeIcons
          aria-hidden="true"
          className="text-muted-foreground size-4"
          icon={SHAPE_ICON[shape.kind]}
        />
        {t(SHAPE_NAME[shape.kind])}
        <ShapeMenu shape={shape} />
      </FieldLegend>
      <ShapePlace shape={shape} />
      <div className="grid grid-cols-2 gap-3">
        {Arr.contains(LABELLED, shape.kind) ? (
          <Field>
            <FieldLabel htmlFor={`${id}-label`}>{t("figure-label")}</FieldLabel>
            <Input
              dir="ltr"
              id={`${id}-label`}
              onChange={(event) =>
                changeShape(shape.id, { label: event.target.value })
              }
              placeholder="A"
              value={shape.label}
            />
          </Field>
        ) : null}
        <Field>
          <FieldLabel htmlFor={`${id}-style`}>{t("figure-style")}</FieldLabel>
          <Select
            items={Arr.map(MathAppearanceSchema.literals, (value) => ({
              label: t(STYLE_NAME[value]),
              value,
            }))}
            onValueChange={(value) => {
              if (isStyle(value)) {
                changeShape(shape.id, { appearance: value });
              }
            }}
            value={shape.appearance}
          >
            <SelectTrigger className="w-full" id={`${id}-style`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent label={editor("menu-style")}>
              {Arr.map(MathAppearanceSchema.literals, (value) => (
                <SelectItem
                  icon={SHAPE_ICON[shape.kind]}
                  key={value}
                  value={value}
                >
                  {t(STYLE_NAME[value])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </FieldSet>
  );
}
