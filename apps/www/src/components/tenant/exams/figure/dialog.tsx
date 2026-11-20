import { Image01Icon } from "@hugeicons/core-free-icons";
import type { VisualName } from "@nakafa/aksara-contracts/visual/catalog";
import { FIGURE_NAMES } from "@nakafa/aksara-contracts/visual/catalog";
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
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { lazy } from "@repo/design-system/lib/lazy";
import { Option, Result } from "effect";
import { Suspense, useId, useState } from "react";
import { useTranslations } from "use-intl";
import type { PendingFigure } from "@/components/tenant/exams/editing";
import {
  FigureField,
  FigurePropsProvider,
} from "@/components/tenant/exams/figure/fields";
import type { FigureDraft } from "@/components/tenant/exams/figure/form";
import {
  emptyDraft,
  figureForm,
  figureOf,
  setAt,
} from "@/components/tenant/exams/figure/form";
import { GraphBuilder } from "@/components/tenant/exams/figure/graph/builder";
import type { GraphDraft } from "@/components/tenant/exams/figure/graph/draft";
import {
  emptyGraph,
  figureDraftOf,
  graphOf,
} from "@/components/tenant/exams/figure/graph/draft";
import { GraphProvider } from "@/components/tenant/exams/figure/graph/provider";
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
 * A MathVisual the graph builder can write opens the builder instead, where the teacher puts each
 * object on the plane or in space like a geometry app.
 */
function FigureForm({
  onClose,
  pending,
}: {
  readonly onClose: () => void;
  readonly pending: PendingFigure;
}) {
  const t = useTranslations("Exams");
  const tCommon = useTranslations("Common");
  const id = useId();
  const [draft, setDraft] = useState<FigureDraft>(pending.draft);
  // The graph the builder opens on, the last one the teacher made, and a fresh builder each time the
  // teacher picks MathVisual again.
  const [graph, setGraph] = useState(() => ({
    draft: graphOf(pending.draft),
    key: 0,
  }));
  const [open, setOpen] = useState(true);
  const made = figureOf(draft);

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
          {tCommon("save")}
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
      {/* A wide dialog's panel fills the screen and scrolls nothing itself: the form scrolls under its header. */}
      <ScrollArea axis="vertical" className="min-h-0 flex-1" scrollFade>
        {/* The end padding keeps a field's border and focus ring clear of the scrollbar. */}
        <FieldGroup className="pe-3">
          <Field>
            <FieldLabel>{t("figure-visual")}</FieldLabel>
            <VisualPicker
              component={draft.component}
              onChoose={(component) => {
                const start = component === "MathVisual" ? emptyGraph() : null;
                setGraph((current) => ({
                  draft: Option.fromNullishOr(start),
                  key: current.key + 1,
                }));
                setDraft((current) =>
                  start === null
                    ? { ...emptyDraft(component), alt: current.alt }
                    : figureDraftOf(
                        { ...start, alt: current.alt },
                        current.caption
                      )
                );
              }}
            />
          </Field>
          {Option.isSome(graph.draft) ? (
            <GraphProvider
              draft={graph.draft.value}
              key={graph.key}
              write={(next: GraphDraft) => {
                setDraft((current) => figureDraftOf(next, current.caption));
                // A dialog that turns into a drawer, or back, mounts the builder again: it opens on this graph.
                setGraph((current) => ({
                  ...current,
                  draft: Option.some(next),
                }));
              }}
            >
              <GraphBuilder />
            </GraphProvider>
          ) : (
            <CatalogFields
              draft={draft}
              id={id}
              made={made}
              setDraft={setDraft}
            />
          )}
        </FieldGroup>
      </ScrollArea>
    </ResponsiveDialog>
  );
}

/** The catalog's own form of a figure: its props by their schema, its words, and the figure or what its schema refuses. */
function CatalogFields({
  draft,
  id,
  made,
  setDraft,
}: {
  readonly draft: FigureDraft;
  readonly id: string;
  readonly made: ReturnType<typeof figureOf>;
  readonly setDraft: (edit: (current: FigureDraft) => FigureDraft) => void;
}) {
  const t = useTranslations("Exams");
  const form = figureForm(draft.component);

  return (
    <>
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
    </>
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
