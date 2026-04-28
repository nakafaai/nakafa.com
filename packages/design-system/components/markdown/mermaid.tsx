import {
  CodeBlockCopyButton,
  CodeBlockDownloadButton,
} from "@repo/design-system/components/ai/code-block";
import { Mermaid } from "@repo/design-system/components/ai/mermaid";
import { languageIconMap } from "@repo/design-system/lib/programming";
import { cn } from "@repo/design-system/lib/utils";
import type { MermaidConfig } from "mermaid";

interface Props {
  chart: string;
  className?: string;
  config?: MermaidConfig;
}

export function MermaidMdx({ chart, className, config }: Props) {
  const Icon = languageIconMap.mermaid;
  const readableConfig: MermaidConfig = {
    ...config,
    flowchart: {
      useMaxWidth: false,
      wrappingWidth: 180,
      ...config?.flowchart,
    },
  };

  return (
    <div
      className={cn(
        "my-4 w-full divide-y overflow-hidden rounded-xl border shadow-sm content-auto-card",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 bg-muted/80 p-1 text-muted-foreground text-sm">
        <div className="flex items-center gap-2 px-4 py-1.5">
          <Icon className="size-4" />
          <span className="ml-1 font-mono lowercase">mermaid</span>
        </div>
        <div className="flex items-center">
          <CodeBlockDownloadButton code={chart} />
          <CodeBlockCopyButton code={chart} />
        </div>
      </div>

      <Mermaid
        chart={chart}
        className="m-0 overflow-x-auto bg-muted/40 p-4 [&_svg]:h-auto [&_svg]:max-w-none"
        config={readableConfig}
      />
    </div>
  );
}
