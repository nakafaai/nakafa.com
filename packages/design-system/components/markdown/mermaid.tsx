import { Maximize02Icon } from "@hugeicons/core-free-icons";
import {
  CodeBlockCopyButton,
  CodeBlockDownloadButton,
  CodeBlockSource,
} from "@repo/design-system/components/ai/code";
import { Mermaid } from "@repo/design-system/components/ai/mermaid";
import { DiagramFrame } from "@repo/design-system/components/markdown/diagram";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
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
            onClick={openDialog}
            size="icon"
            title={t("open-diagram")}
            tooltip={t("open-diagram")}
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

/**
 * The diagram in the dialog that opens it, filling the dialog's body. The
 * body does not scroll, so this box is the one place a larger diagram does.
 */
function DialogDiagram() {
  const { chart, config, title } = useMermaidFigure();

  return (
    <Mermaid
      chart={chart}
      className="bg-muted/40 min-h-0 flex-1 basis-[60dvh] rounded-lg p-4 text-base"
      config={config}
      label={title}
    />
  );
}

/**
 * Shows a diagram in a frame whose size never depends on the diagram, and in
 * a dialog that gives it the whole screen. Both fit the diagram at a legible
 * scale. The chart is drawn as written: authored content reaches here only
 * after Aksara parsed it with the same Mermaid, and a model's chart is made
 * safe by the markdown renderer before it arrives.
 */
export function MermaidMdx({
  chart,
  className,
  config,
  description,
  title,
}: Props) {
  const [open, setOpen] = useState(false);
  const figure = useMemo(
    () => ({
      chart,
      className,
      config,
      openDialog: () => setOpen(true),
      title,
    }),
    [chart, className, config, title]
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
