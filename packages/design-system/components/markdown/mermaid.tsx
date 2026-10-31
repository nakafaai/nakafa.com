import { Maximize02Icon } from "@hugeicons/core-free-icons";
import {
  CodeBlockCopyButton,
  CodeBlockDownloadButton,
  CodeBlockSource,
} from "@repo/design-system/components/ai/code-block";
import { Mermaid } from "@repo/design-system/components/ai/mermaid";
import { DiagramFrame } from "@repo/design-system/components/markdown/diagram";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { normalizeMermaidChart } from "@repo/design-system/lib/markdown/mermaid";
import type { MermaidRenderConfig } from "@repo/design-system/lib/mermaid/render";
import { createContext, use, useMemo, useState } from "react";
import { useTranslations } from "use-intl";

interface Props {
  chart: string;
  className?: string | undefined;
  config?: MermaidRenderConfig | undefined;
  description: string;
  title: string;
}

/** What the diagram's card and its dialog draw: the source, the settings and the words, and how the card opens the dialog. */
type MermaidFigure = Pick<Props, "chart" | "className" | "config" | "title"> & {
  readonly openDialog: () => void;
};

const MermaidFigureContext = createContext<MermaidFigure | null>(null);

/** Selects the figure of the surrounding diagram. */
function useMermaidFigure() {
  const figure = use(MermaidFigureContext);
  if (figure === null) {
    // A missing diagram is a programmer composition error at this React seam.
    throw new Error("Diagram parts require MermaidMdx.");
  }
  return figure;
}

/** The diagram in its card, with the controls that open it and copy its source. */
function DiagramCard() {
  const t = useTranslations("Ai");
  const { chart, className, config, openDialog, title } = useMermaidFigure();

  return (
    <DiagramFrame
      actions={
        <>
          <Button
            aria-label={t("open-diagram")}
            onClick={openDialog}
            size="icon"
            title={t("open-diagram")}
            variant="ghost"
          >
            <HugeIcons icon={Maximize02Icon} />
          </Button>
          <CodeBlockSource code={chart} language="mermaid">
            <CodeBlockDownloadButton />
            <CodeBlockCopyButton />
          </CodeBlockSource>
        </>
      }
      className={className}
      title={title}
    >
      <Mermaid
        chart={chart}
        className="size-full"
        config={config}
        label={title}
      />
    </DiagramFrame>
  );
}

/** The diagram at its natural size, in the dialog that opens it. */
function DialogDiagram() {
  const { chart, config, title } = useMermaidFigure();

  return (
    <Mermaid
      chart={chart}
      className="h-[60dvh] rounded-lg bg-muted/40 p-4 text-base"
      config={config}
      fit="natural"
      label={title}
    />
  );
}

/**
 * Shows a diagram in a frame whose size never depends on the diagram: the
 * preview scales the diagram to fit, and the dialog shows it at its natural
 * size, so its labels keep the size the diagram gives them.
 */
export function MermaidMdx({
  chart,
  className,
  config,
  description,
  title,
}: Props) {
  const renderableChart = normalizeMermaidChart(chart);
  const [open, setOpen] = useState(false);
  const figure = useMemo(
    () => ({
      chart: renderableChart,
      className,
      config,
      openDialog: () => setOpen(true),
      title,
    }),
    [className, config, renderableChart, title]
  );

  return (
    <MermaidFigureContext value={figure}>
      <DiagramCard />
      <ResponsiveDialog
        description={description}
        open={open}
        setOpen={setOpen}
        size="wide"
        title={title}
      >
        <DialogDiagram />
      </ResponsiveDialog>
    </MermaidFigureContext>
  );
}
