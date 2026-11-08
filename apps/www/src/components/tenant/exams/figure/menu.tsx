import {
  ChartBarBigIcon,
  ChartLineData01Icon,
  FlowConnectionIcon,
  PresentationBarChart01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { emptyDraft, FigureKind } from "@/components/tenant/exams/figure/draft";
import { useExamEditing } from "@/components/tenant/exams/provider";

/** The icon of each figure a teacher makes. */
const FIGURE_ICON = {
  chart: ChartBarBigIcon,
  diagram: FlowConnectionIcon,
  graph: ChartLineData01Icon,
} satisfies Record<FigureKind, typeof ChartBarBigIcon>;

/** The name of each figure a teacher makes. */
const FIGURE_NAME = {
  chart: "figure-chart",
  diagram: "figure-diagram",
  graph: "figure-graph",
} as const satisfies Record<FigureKind, string>;

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
 * The toolbar's control that adds a figure to the active editor: a graph of a function, a chart of values, or a
 * diagram, each written in its own dialog.
 */
export function FigureMenu() {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const active = useExamEditing((state) => state.active);
  const openFigure = useExamEditing((state) => state.openFigure);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon-sm"
            tooltip={t("figure")}
            type="button"
            variant="ghost"
          />
        }
      >
        <HugeIcons aria-hidden="true" icon={PresentationBarChart01Icon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" label={common("menu-insert")}>
        {Arr.map(FigureKind.literals, (kind) => (
          <DropdownMenuItem
            disabled={active === null}
            icon={FIGURE_ICON[kind]}
            key={kind}
            onClick={() => {
              if (active !== null) {
                openFigure({
                  draft: emptyDraft(kind),
                  editor: active,
                  position: null,
                });
              }
            }}
          >
            {t(FIGURE_NAME[kind])}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
