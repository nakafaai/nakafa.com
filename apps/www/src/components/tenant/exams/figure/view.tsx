import { Cancel01Icon, PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { FigureAttrsSchema } from "@nakafa/aksara-contracts/assessment/figure";
import type { DocumentEditorInstance } from "@repo/design-system/components/editor/document";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Option, Schema } from "effect";
import { lazy, Suspense } from "react";
import { useTranslations } from "use-intl";
import { draftOf } from "@/components/tenant/exams/figure/draft";
import { useExamEditing } from "@/components/tenant/exams/provider";

/** A figure's code loads with the first figure of a text. */
const LazyFigure = lazy(() =>
  import("@/components/assessment/figure").then((module) => ({
    default: module.DocumentFigure,
  }))
);

/**
 * One figure in a text being written, drawn as the student reads it, with the teacher's controls over its corner
 * while the text takes changes. A figure a teacher cannot make here, as one a file brought in, can only be removed.
 */
export function ExamFigure({
  attrs,
  editor,
  onRemove,
  position,
}: {
  readonly attrs: unknown;
  readonly editor: DocumentEditorInstance;
  readonly onRemove: () => void;
  readonly position: number | null;
}) {
  const t = useTranslations("Exams");
  const openFigure = useExamEditing((state) => state.openFigure);
  const editing = Option.flatMap(
    Schema.decodeUnknownOption(FigureAttrsSchema)(attrs),
    draftOf
  );

  return (
    <>
      <Suspense fallback={null}>
        <LazyFigure attrs={attrs} />
      </Suspense>
      {editor.isEditable ? (
        <div className="absolute end-2 top-2 flex gap-1">
          {Option.isSome(editing) ? (
            <Button
              aria-label={t("figure-edit")}
              onClick={() =>
                openFigure({ draft: editing.value, editor, position })
              }
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <HugeIcons aria-hidden="true" icon={PencilEdit01Icon} />
            </Button>
          ) : null}
          <Button
            aria-label={t("figure-remove")}
            onClick={onRemove}
            size="icon-sm"
            type="button"
            variant="outline"
          >
            <HugeIcons aria-hidden="true" icon={Cancel01Icon} />
          </Button>
        </div>
      ) : null}
    </>
  );
}
