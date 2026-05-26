"use client";

import { Maximize02Icon } from "@hugeicons/core-free-icons";
import {
  CodeBlockCopyButton,
  CodeBlockDownloadButton,
} from "@repo/design-system/components/ai/code-block";
import { Mermaid } from "@repo/design-system/components/ai/mermaid";
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
import { normalizeMermaidChart } from "@repo/design-system/lib/mermaid";
import { languageIconMap } from "@repo/design-system/lib/programming";
import { cn } from "@repo/design-system/lib/utils";
import type { MermaidConfig } from "mermaid";

interface Props {
  chart: string;
  className?: string;
  config?: MermaidConfig;
  description: string;
  title: string;
}

export function MermaidMdx({
  chart,
  className,
  config,
  description,
  title,
}: Props) {
  const Icon = languageIconMap.mermaid;
  const renderableChart = normalizeMermaidChart(chart);

  return (
    <Dialog>
      <div
        className={cn(
          "my-4 w-full divide-y overflow-hidden rounded-xl border shadow-sm content-auto-card",
          className
        )}
        data-nakafa="mermaid-card"
      >
        <div className="flex items-center justify-between gap-2 bg-muted/80 p-1 text-muted-foreground text-sm">
          <div className="flex min-w-0 items-center gap-2 px-4 py-1.5">
            <Icon className="size-4" />
            <span className="ml-1 truncate text-foreground">{title}</span>
          </div>
          <div className="flex items-center">
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
            <CodeBlockDownloadButton code={renderableChart} />
            <CodeBlockCopyButton code={renderableChart} />
          </div>
        </div>

        <Mermaid
          chart={renderableChart}
          className="m-0 overflow-hidden bg-muted/40 p-4 text-base [&_svg]:h-auto [&_svg]:max-w-full"
          config={config}
          label={title}
        />
      </div>

      <DialogContent className="grid max-h-[min(90dvh,900px)] w-[calc(100%-2rem)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-7xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogPanel className="rounded-lg border bg-muted/40 p-4">
          <Mermaid
            chart={renderableChart}
            className="m-0 min-h-[50dvh] overflow-hidden text-base [&_svg]:h-auto [&_svg]:max-w-full"
            config={config}
            label={title}
          />
        </DialogPanel>
      </DialogContent>
    </Dialog>
  );
}
