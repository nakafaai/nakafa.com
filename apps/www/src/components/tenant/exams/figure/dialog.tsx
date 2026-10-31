import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Array as Arr, Option, Schema } from "effect";
import { lazy, type ReactNode, Suspense, useId, useState } from "react";
import { useTranslations } from "use-intl";
import type { PendingFigure } from "@/components/tenant/exams/editing";
import {
  ChartMark,
  type FigureDraft,
  type FigureKind,
  figureOf,
  GraphCurve,
} from "@/components/tenant/exams/figure/draft";
import { useExamEditing } from "@/components/tenant/exams/provider";

/** The figure's code loads when a dialog first shows one. */
const LazyFigure = lazy(() =>
  import("@/components/assessment/figure").then((module) => ({
    default: module.DocumentFigure,
  }))
);

/** The dialog's title for each figure a teacher makes. */
const FIGURE_NAME = {
  chart: "figure-chart",
  diagram: "figure-diagram",
  graph: "figure-graph",
} as const satisfies Record<FigureKind, string>;

/** The name of each curve of a graph. */
const CURVE_NAME = {
  line: "figure-line",
  quadratic: "figure-quadratic",
} as const satisfies Record<GraphCurve, string>;

/** The name of each way a chart draws its values. */
const MARK_NAME = {
  bar: "figure-bars",
  line: "figure-lines",
} as const satisfies Record<ChartMark, string>;

/** Whether a value the select gives is one of the curves. */
const isCurve = Schema.is(GraphCurve);

/** Whether a value the select gives is one of the marks. */
const isMark = Schema.is(ChartMark);

/** One field of the figure's form: its name, its control, and a line on how to fill it. */
function FigureField({
  children,
  hint,
  id,
  label,
}: {
  readonly children: ReactNode;
  readonly hint?: string;
  readonly id: string;
  readonly label: string;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {hint === undefined ? null : <FieldDescription>{hint}</FieldDescription>}
    </Field>
  );
}

/** The fields of a graph: its curve, the numbers of its formula, and the range of x it draws. */
function GraphFields({
  draft,
  onChange,
}: {
  readonly draft: FigureDraft;
  readonly onChange: (change: Partial<FigureDraft>) => void;
}) {
  const t = useTranslations("Exams");
  const id = useId();

  return (
    <>
      <FigureField id={`${id}-curve`} label={t("figure-curve")}>
        <Select
          items={Arr.map(GraphCurve.literals, (value) => ({
            label: t(CURVE_NAME[value]),
            value,
          }))}
          onValueChange={(value) => {
            if (isCurve(value)) {
              onChange({ curve: value });
            }
          }}
          value={draft.curve}
        >
          <SelectTrigger className="w-full" id={`${id}-curve`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Arr.map(GraphCurve.literals, (value) => (
              <SelectItem key={value} value={value}>
                {t(CURVE_NAME[value])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FigureField>
      <div className="grid grid-cols-3 gap-3">
        <FigureField id={`${id}-a`} label="a">
          <Input
            id={`${id}-a`}
            inputMode="decimal"
            onChange={(event) => onChange({ a: event.target.value })}
            placeholder="1"
            value={draft.a}
          />
        </FigureField>
        <FigureField id={`${id}-b`} label="b">
          <Input
            id={`${id}-b`}
            inputMode="decimal"
            onChange={(event) => onChange({ b: event.target.value })}
            placeholder="0"
            value={draft.b}
          />
        </FigureField>
        {draft.curve === "quadratic" ? (
          <FigureField id={`${id}-c`} label="c">
            <Input
              id={`${id}-c`}
              inputMode="decimal"
              onChange={(event) => onChange({ c: event.target.value })}
              placeholder="0"
              value={draft.c}
            />
          </FigureField>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FigureField id={`${id}-from`} label={t("figure-from")}>
          <Input
            id={`${id}-from`}
            inputMode="decimal"
            onChange={(event) => onChange({ from: event.target.value })}
            placeholder="-5"
            value={draft.from}
          />
        </FigureField>
        <FigureField id={`${id}-to`} label={t("figure-to")}>
          <Input
            id={`${id}-to`}
            inputMode="decimal"
            onChange={(event) => onChange({ to: event.target.value })}
            placeholder="5"
            value={draft.to}
          />
        </FigureField>
      </div>
    </>
  );
}

/** The fields of a chart: its labels, its values, and how it draws them. */
function ChartFields({
  draft,
  onChange,
}: {
  readonly draft: FigureDraft;
  readonly onChange: (change: Partial<FigureDraft>) => void;
}) {
  const t = useTranslations("Exams");
  const id = useId();

  return (
    <>
      <FigureField
        hint={t("figure-labels-hint")}
        id={`${id}-labels`}
        label={t("figure-labels")}
      >
        <Input
          dir="auto"
          id={`${id}-labels`}
          onChange={(event) => onChange({ categories: event.target.value })}
          placeholder={t("figure-labels-placeholder")}
          value={draft.categories}
        />
      </FigureField>
      <FigureField
        hint={t("figure-values-hint")}
        id={`${id}-values`}
        label={t("figure-values")}
      >
        <Input
          id={`${id}-values`}
          inputMode="decimal"
          onChange={(event) => onChange({ values: event.target.value })}
          placeholder="70 80 90"
          value={draft.values}
        />
      </FigureField>
      <FigureField id={`${id}-mark`} label={t("figure-mark")}>
        <Select
          items={Arr.map(ChartMark.literals, (value) => ({
            label: t(MARK_NAME[value]),
            value,
          }))}
          onValueChange={(value) => {
            if (isMark(value)) {
              onChange({ mark: value });
            }
          }}
          value={draft.mark}
        >
          <SelectTrigger className="w-full" id={`${id}-mark`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Arr.map(ChartMark.literals, (value) => (
              <SelectItem key={value} value={value}>
                {t(MARK_NAME[value])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FigureField>
    </>
  );
}

/** The form of one figure, with the figure itself under its fields as it takes shape. */
function FigureForm({
  onClose,
  pending,
}: {
  readonly onClose: () => void;
  readonly pending: PendingFigure;
}) {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const id = useId();
  const [draft, setDraft] = useState(pending.draft);
  const [open, setOpen] = useState(true);
  const made = figureOf(draft);
  const change = (next: Partial<FigureDraft>) =>
    setDraft((current) => ({ ...current, ...next }));

  /** Places the figure at the caret, or in the place of the one it edits. */
  const save = () => {
    const { editor, position } = pending;
    if (Option.isNone(made) || editor.isDestroyed) {
      return;
    }
    if (position === null) {
      editor
        .chain()
        .focus()
        .insertContent({ attrs: made.value, type: "figure" })
        .run();
    } else {
      editor.view.dispatch(
        editor.state.tr.setNodeMarkup(position, undefined, made.value)
      );
    }
    setOpen(false);
  };

  return (
    <ResponsiveDialog
      description={t("figure-description")}
      footer={
        <>
          <Button onClick={() => setOpen(false)} variant="outline">
            {common("cancel")}
          </Button>
          <Button disabled={Option.isNone(made)} onClick={save}>
            {t("figure-save")}
          </Button>
        </>
      }
      onOpenChangeComplete={(next) => {
        if (!next) {
          onClose();
        }
      }}
      open={open}
      setOpen={setOpen}
      title={t(FIGURE_NAME[draft.kind])}
    >
      <FieldGroup>
        <FigureField id={`${id}-title`} label={t("figure-name")}>
          <Input
            dir="auto"
            id={`${id}-title`}
            onChange={(event) => change({ title: event.target.value })}
            placeholder={t("figure-name-placeholder")}
            value={draft.title}
          />
        </FigureField>
        {draft.kind === "graph" ? (
          <GraphFields draft={draft} onChange={change} />
        ) : null}
        {draft.kind === "chart" ? (
          <ChartFields draft={draft} onChange={change} />
        ) : null}
        {draft.kind === "diagram" ? (
          <FigureField
            hint={t("figure-source-hint")}
            id={`${id}-source`}
            label={t("figure-source")}
          >
            <Textarea
              className="font-mono"
              dir="ltr"
              id={`${id}-source`}
              onChange={(event) => change({ chart: event.target.value })}
              placeholder="graph TD; A-->B"
              value={draft.chart}
            />
          </FigureField>
        ) : null}
        <FigureField
          hint={t("figure-alt-hint")}
          id={`${id}-alt`}
          label={t("figure-alt")}
        >
          <Input
            dir="auto"
            id={`${id}-alt`}
            onChange={(event) => change({ alt: event.target.value })}
            placeholder={t("figure-alt-placeholder")}
            value={draft.alt}
          />
        </FigureField>
        {Option.isSome(made) ? (
          <Suspense fallback={null}>
            <LazyFigure attrs={made.value} />
          </Suspense>
        ) : null}
      </FieldGroup>
    </ResponsiveDialog>
  );
}

/** The dialog that writes a figure of an exam, in the row of the toolbar that opens it. */
export function FigureDialog() {
  const figure = useExamEditing((state) => state.figure);
  const closeFigure = useExamEditing((state) => state.closeFigure);

  return figure === null ? null : (
    <FigureForm onClose={closeFigure} pending={figure} />
  );
}
