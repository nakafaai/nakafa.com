import { PresentationBarChart01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "use-intl";
import { emptyDraft } from "@/components/tenant/exams/figure/form";
import { useExamEditing } from "@/components/tenant/exams/provider";

/** The control before the exam is read, in its place and disabled, so the row stands from the first paint. */
export function FigureMenuFrame() {
  const t = useTranslations("Exams");

  return (
    <Button size="icon-sm" tooltip={t("figure")} type="button" variant="ghost">
      <HugeIcons aria-hidden="true" icon={PresentationBarChart01Icon} />
    </Button>
  );
}

/**
 * The toolbar's control that adds a figure to the active editor: any visual of the Visual Catalog,
 * written in its dialog, which opens on a chart.
 */
export function FigureMenu() {
  const t = useTranslations("Exams");
  const active = useExamEditing((state) => state.active);
  const openFigure = useExamEditing((state) => state.openFigure);

  return (
    <Button
      disabled={active === null}
      onClick={() => {
        if (active !== null) {
          openFigure({
            draft: emptyDraft("Chart"),
            editor: active,
            position: null,
          });
        }
      }}
      size="icon-sm"
      tooltip={t("figure")}
      type="button"
      variant="ghost"
    >
      <HugeIcons aria-hidden="true" icon={PresentationBarChart01Icon} />
    </Button>
  );
}
