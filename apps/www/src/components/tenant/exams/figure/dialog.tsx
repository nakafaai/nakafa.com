import { Image01Icon } from "@hugeicons/core-free-icons";
import {
  FIGURE_NAMES,
  type VisualName,
} from "@nakafa/aksara-contracts/visual/catalog";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Picker,
  PickerContent,
  PickerItem,
  PickerTrigger,
} from "@repo/design-system/components/ui/picker";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { lazy } from "@repo/design-system/lib/lazy";
import { Result } from "effect";
import { Suspense, useId, useState } from "react";
import { useTranslations } from "use-intl";
import type { PendingFigure } from "@/components/tenant/exams/editing";
import {
  FigureField,
  FigurePropsProvider,
} from "@/components/tenant/exams/figure/fields";
import {
  emptyDraft,
  type FigureDraft,
  figureForm,
  figureOf,
  setAt,
} from "@/components/tenant/exams/figure/form";
import { useExamEditing } from "@/components/tenant/exams/provider";

/** The figure's code loads when a dialog first shows one. */
const LazyFigure = lazy(() =>
  import("@/components/assessment/figure").then((module) => ({
    default: module.AssessmentFigure,
  }))
);

/** The picker of the visual a figure draws: every figure of the Visual Catalog, found by its name. */
function VisualPicker({
  component,
  onChoose,
}: {
  readonly component: string;
  readonly onChoose: (component: VisualName) => void;
}) {
  const common = useTranslations("Common");
  const t = useTranslations("Exams");

  return (
    <Picker>
      <PickerTrigger
        render={
          <Button className="justify-between" type="button" variant="outline" />
        }
      >
        {component}
      </PickerTrigger>
      <PickerContent
        empty={t("figure-visual-empty")}
        items={FIGURE_NAMES}
        itemToStringValue={(name) => name}
        label={common("menu-visual")}
        placeholder={t("figure-visual-placeholder")}
      >
        {(name) => (
          <PickerItem
            icon={Image01Icon}
            key={name}
            onClick={() => onChoose(name)}
            selected={name === component}
            value={name}
          >
            {name}
          </PickerItem>
        )}
      </PickerContent>
    </Picker>
  );
}

/**
 * The form of one figure: the visual it draws, its props as that visual's catalog schema reads them,
 * the words it says to a student who cannot see it, and the figure itself as it takes
 * shape. What the schema refuses is named under the form, and the figure is saved only once it holds.
 */
function FigureForm({
  onClose,
  pending,
}: {
  readonly onClose: () => void;
  readonly pending: PendingFigure;
}) {
  const t = useTranslations("Exams");
  const id = useId();
  const [draft, setDraft] = useState<FigureDraft>(pending.draft);
  const [open, setOpen] = useState(true);
  const made = figureOf(draft);
  const form = figureForm(draft.component);

  /** Places the figure at the caret, or in the place of the one it edits. */
  const save = () => {
    const { editor, position } = pending;
    if (Result.isFailure(made) || editor.isDestroyed) {
      return;
    }
    if (position === null) {
      editor
        .chain()
        .focus()
        .insertContent({ attrs: made.success, type: "figure" })
        .run();
    } else {
      editor.view.dispatch(
        editor.state.tr.setNodeMarkup(position, undefined, made.success)
      );
    }
    setOpen(false);
  };

  return (
    <ResponsiveDialog
      action={
        <Button disabled={Result.isFailure(made)} onClick={save}>
          {t("figure-save")}
        </Button>
      }
      description={t("figure-description")}
      onOpenChangeComplete={(next) => {
        if (!next) {
          onClose();
        }
      }}
      open={open}
      setOpen={setOpen}
      size="wide"
      title={t("figure")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel>{t("figure-visual")}</FieldLabel>
          <VisualPicker
            component={draft.component}
            onChoose={(component) =>
              setDraft((current) => ({
                ...emptyDraft(component),
                alt: current.alt,
              }))
            }
          />
        </Field>
        <FigurePropsProvider
          props={draft.props}
          write={(path, value) =>
            setDraft((current) => ({
              ...current,
              props: setAt(current.props, path, value),
            }))
          }
        >
          {form.kind === "group" ? (
            <FigureField
              field={form}
              name={draft.component}
              optional={false}
              path={[]}
            />
          ) : null}
        </FigurePropsProvider>
        <Field>
          <FieldLabel htmlFor={`${id}-alt`}>{t("figure-alt")}</FieldLabel>
          <Input
            dir="auto"
            id={`${id}-alt`}
            onChange={(event) =>
              setDraft((current) => ({ ...current, alt: event.target.value }))
            }
            placeholder={t("figure-alt-placeholder")}
            value={draft.alt}
          />
        </Field>
        {Result.match(made, {
          onFailure: (reason) => (
            <FieldError className="whitespace-pre-wrap">{reason}</FieldError>
          ),
          onSuccess: (attrs) => (
            <Suspense fallback={null}>
              <LazyFigure attrs={attrs} />
            </Suspense>
          ),
        })}
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
