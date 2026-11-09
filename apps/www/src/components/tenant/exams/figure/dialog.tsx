import { ChartBubble01Icon } from "@hugeicons/core-free-icons";
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
import { useId, useState } from "react";
import { useTranslations } from "use-intl";
import type { PendingFigure } from "@/components/tenant/exams/editing";
import { GraphBuilder } from "@/components/tenant/exams/figure/builder";
import { ChartMark, type FigureKind } from "@/components/tenant/exams/figure/draft";
import {
  AltField,
  FigurePreview,
  NameField,
} from "@/components/tenant/exams/figure/fields";
import {
  FigureProvider,
  useFigure,
} from "@/components/tenant/exams/figure/provider";
import { useExamEditing } from "@/components/tenant/exams/provider";

/** The dialog's title for each figure a teacher makes. */
const FIGURE_NAME = {
  chart: "figure-chart",
  diagram: "figure-diagram",
  graph: "figure-graph",
} as const satisfies Record<FigureKind, string>;

/** The name of each way a chart draws its values. */
const MARK_NAME = {
  bar: "figure-bars",
  line: "figure-lines",
} as const satisfies Record<ChartMark, string>;

/** Whether a value the select gives is one of the marks. */
const isMark = Schema.is(ChartMark);

/** The fields of a chart: its labels, its values, and how it draws them. */
function ChartFields() {
  const common = useTranslations("Common");
  const t = useTranslations("Exams");
  const categories = useFigure((state) => state.draft.categories);
  const values = useFigure((state) => state.draft.values);
  const mark = useFigure((state) => state.draft.mark);
  const change = useFigure((state) => state.change);
  const id = useId();

  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${id}-labels`}>{t("figure-labels")}</FieldLabel>
        <Input
          dir="auto"
          id={`${id}-labels`}
          onChange={(event) => change({ categories: event.target.value })}
          placeholder={t("figure-labels-placeholder")}
          value={categories}
        />
        <FieldDescription>{t("figure-labels-hint")}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-values`}>{t("figure-values")}</FieldLabel>
        <Input
          id={`${id}-values`}
          inputMode="decimal"
          onChange={(event) => change({ values: event.target.value })}
          placeholder="70 80 90"
          value={values}
        />
        <FieldDescription>{t("figure-values-hint")}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-mark`}>{t("figure-mark")}</FieldLabel>
        <Select
          items={Arr.map(ChartMark.literals, (value) => ({
            label: t(MARK_NAME[value]),
            value,
          }))}
          onValueChange={(value) => {
            if (isMark(value)) {
              change({ mark: value });
            }
          }}
          value={mark}
        >
          <SelectTrigger className="w-full" id={`${id}-mark`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent label={common("menu-mark")}>
            {Arr.map(ChartMark.literals, (value) => (
              <SelectItem icon={ChartBubble01Icon} key={value} value={value}>
                {t(MARK_NAME[value])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </>
  );
}

/** The source of a diagram, written in Mermaid. */
function DiagramField() {
  const t = useTranslations("Exams");
  const chart = useFigure((state) => state.draft.chart);
  const change = useFigure((state) => state.change);
  const id = useId();

  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("figure-source")}</FieldLabel>
      <Textarea
        className="font-mono"
        dir="ltr"
        id={id}
        onChange={(event) => change({ chart: event.target.value })}
        placeholder="graph TD; A-->B"
        value={chart}
      />
      <FieldDescription>{t("figure-source-hint")}</FieldDescription>
    </Field>
  );
}

/**
 * The dialog of one figure. A graph opens the builder, the plane beside the objects on it; a chart and a diagram
 * open their fields over the figure as it takes shape. Saving places the figure at once: at the caret, or in the
 * place of the one it edits.
 */
function FigureForm({
  onClose,
  pending,
}: {
  readonly onClose: () => void;
  readonly pending: PendingFigure;
}) {
  const t = useTranslations("Exams");
  const kind = useFigure((state) => state.draft.kind);
  const made = useFigure((state) => state.figure);
  const [open, setOpen] = useState(true);

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
      action={
        <Button disabled={Option.isNone(made)} onClick={save}>
          {t("figure-save")}
        </Button>
      }
      description={t(
        kind === "graph" ? "figure-graph-description" : "figure-description"
      )}
      onOpenChangeComplete={(next) => {
        if (!next) {
          onClose();
        }
      }}
      open={open}
      setOpen={setOpen}
      size={kind === "graph" ? "wide" : "default"}
      title={t(FIGURE_NAME[kind])}
    >
      {kind === "graph" ? (
        <GraphBuilder />
      ) : (
        <FieldGroup>
          <NameField />
          {kind === "chart" ? <ChartFields /> : <DiagramField />}
          <AltField />
          <FigurePreview />
        </FieldGroup>
      )}
    </ResponsiveDialog>
  );
}

/** The dialog that writes a figure of an exam, in the row of the toolbar that opens it. */
export function FigureDialog() {
  const figure = useExamEditing((state) => state.figure);
  const closeFigure = useExamEditing((state) => state.closeFigure);

  return figure === null ? null : (
    <FigureProvider draft={figure.draft}>
      <FigureForm onClose={closeFigure} pending={figure} />
    </FigureProvider>
  );
}
