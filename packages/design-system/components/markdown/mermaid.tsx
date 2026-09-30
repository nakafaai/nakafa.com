"use client";

import { Maximize02Icon } from "@hugeicons/core-free-icons";
import {
  CodeBlockCopyButton,
  CodeBlockDownloadButton,
  CodeBlockSource,
} from "@repo/design-system/components/ai/code-block";
import { Mermaid } from "@repo/design-system/components/ai/mermaid";
import { DiagramFrame } from "@repo/design-system/components/markdown/diagram";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { normalizeMermaidChart } from "@repo/design-system/lib/markdown/mermaid";
import type { MermaidRenderConfig } from "@repo/design-system/lib/mermaid/render";

interface Props {
  chart: string;
  className?: string;
  config?: MermaidRenderConfig;
  description: string;
  title: string;
}

/**
 * Shows a diagram in a frame whose size never depends on the diagram: the
 * preview scales the diagram to fit, and the dialog shows it at full width.
 */
export function MermaidMdx({
  chart,
  className,
  config,
  description,
  title,
}: Props) {
  const renderableChart = normalizeMermaidChart(chart);

  return (
    <Dialog>
      <DiagramFrame
        actions={
          <>
            <DialogTrigger
              render={
                <Button
                  aria-label="Open larger diagram"
                  size="icon"
                  variant="ghost"
                >
                  <HugeIcons icon={Maximize02Icon} />
                </Button>
              }
            />
            <CodeBlockSource code={renderableChart} language="mermaid">
              <CodeBlockDownloadButton />
              <CodeBlockCopyButton />
            </CodeBlockSource>
          </>
        }
        className={className}
        title={title}
      >
        <Mermaid
          chart={renderableChart}
          className="size-full"
          config={config}
          label={title}
        />
      </DiagramFrame>

      <DialogContent size="wide">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <Mermaid
            chart={renderableChart}
            className="h-[60dvh] rounded-lg border bg-muted/40 p-4 text-base"
            config={config}
            fit="width"
            label={title}
          />
        </DialogPanel>
      </DialogContent>
    </Dialog>
  );
}
