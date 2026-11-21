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
import {
  PlanePlace,
  SpacePlace,
} from "@/components/tenant/exams/figure/graph/place";
import { freeName } from "@/components/tenant/exams/figure/graph/plane";
import { useGraph } from "@/components/tenant/exams/figure/graph/provider";
import type { ShapeDraft } from "@/components/tenant/exams/figure/graph/shapes";
import {
  LABELLED,
  ShapeKind,
} from "@/components/tenant/exams/figure/graph/shapes";
import { SPACE_KINDS } from "@/components/tenant/exams/figure/graph/space";

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
  angle: "Common.angle",
  circle: "Exams.figure-circle",
  equation: "Common.equation",
  function: "Exams.figure-function",
  line: "Exams.figure-line",
  point: "Exams.figure-point",
  polygon: "Exams.figure-polygon",
  ray: "Exams.figure-ray",
  region: "Exams.figure-region",
  segment: "Exams.figure-segment",
  vector: "Exams.figure-vector",
} as const satisfies Record<ShapeKind, string>;

/** The name of each role an object takes, which the design system draws in its own way. */
const STYLE_NAME = {
  answer: "Common.answer",
  construction: "Exams.figure-construction",
  highlight: "Exams.figure-highlight",
  primary: "Exams.figure-primary",
  reference: "Exams.figure-reference",
  secondary: "Exams.figure-secondary",
  warning: "Exams.figure-warning",
} as const satisfies Record<typeof MathAppearanceSchema.Type, string>;

/** Whether a value the style select gives is one of the roles. */
const isStyle = Schema.is(MathAppearanceSchema);

/** The menu that puts a new object or a slider on the graph, drawn at once where it starts: in space, the kinds it draws in 3D. */
export function AddMenu() {
  const common = useTranslations("Common");
  const t = useTranslations("Exams");
  const label = useTranslations();
  const addShape = useGraph((state) => state.addShape);
  const addSlider = useGraph((state) => state.addSlider);
  const space = useGraph((state) => state.draft.space === "space");
  const full = useGraph((state) =>
    Option.isNone(freeName(state.draft.sliders))
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button className="w-full" type="button" variant="outline" />}
      >
        <HugeIcons aria-hidden="true" icon={Add01Icon} />
        {common("add")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" label={common("menu-insert")}>
        {Arr.map(space ? SPACE_KINDS : ShapeKind.literals, (kind) => (
          <DropdownMenuItem
            icon={SHAPE_ICON[kind]}
            key={kind}
            onSelect={() => addShape(kind)}
          >
            {label(SHAPE_NAME[kind])}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem
          disabled={full}
          icon={SlidersHorizontalIcon}
          onSelect={addSlider}
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
  const copyShape = useGraph((state) => state.copyShape);
  const removeShape = useGraph((state) => state.removeShape);

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
        <DropdownMenuItem
          icon={Copy01Icon}
          onSelect={() => copyShape(shape.id)}
        >
          {t("grid-duplicate")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          icon={Delete02Icon}
          onSelect={() => removeShape(shape.id)}
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
  const label = useTranslations();
  const changeShape = useGraph((state) => state.changeShape);
  const space = useGraph((state) => state.draft.space === "space");
  const id = useId();

  return (
    <FieldSet className="gap-3 rounded-lg border p-3">
      <FieldLegend className="flex w-full items-center gap-2" variant="label">
        <HugeIcons
          aria-hidden="true"
          className="text-muted-foreground"
          icon={SHAPE_ICON[shape.kind]}
        />
        {label(SHAPE_NAME[shape.kind])}
        <ShapeMenu shape={shape} />
      </FieldLegend>
      {space ? <SpacePlace shape={shape} /> : <PlanePlace shape={shape} />}
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
              label: label(STYLE_NAME[value]),
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
                <SelectItem key={value} plain value={value}>
                  {label(STYLE_NAME[value])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </FieldSet>
  );
}
