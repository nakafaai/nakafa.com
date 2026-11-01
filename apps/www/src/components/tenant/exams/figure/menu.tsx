import {
  ChartBarBigIcon,
  ChartLineData01Icon,
  FlowConnectionIcon,
  PresentationBarChart01Icon,
} from "@hugeicons/core-free-icons";
import { ToolHint } from "@repo/design-system/components/editor/tip";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
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
    <Button
      aria-label={t("figure")}
      size="icon-sm"
      type="button"
      variant="ghost"
    >
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
      <ToolHint label={t("figure")}>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t("figure")}
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <HugeIcons aria-hidden="true" icon={PresentationBarChart01Icon} />
        </DropdownMenuTrigger>
      </ToolHint>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{common("menu-insert")}</DropdownMenuLabel>
          {Arr.map(FigureKind.literals, (kind) => (
            <DropdownMenuItem
              disabled={active === null}
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
              <HugeIcons aria-hidden="true" icon={FIGURE_ICON[kind]} />
              {t(FIGURE_NAME[kind])}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
