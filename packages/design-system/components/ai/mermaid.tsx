"use client";

import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { cn } from "@repo/design-system/lib/utils";
import type { MermaidConfig } from "mermaid";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const ALPHANUMERIC_BASE = 36;
const MAGIC_NUMBER = 0;
const RANDOM_STRING_LENGTH = 9;
const SHIFT_5 = 5;

const initializeMermaid = async (customConfig?: MermaidConfig) => {
  const defaultConfig: MermaidConfig = {
    startOnLoad: false,
    theme: "default",
    securityLevel: "strict",
    fontFamily: "monospace",
    fontSize: 14,
    suppressErrorRendering: true,
  } as MermaidConfig;

  const config = { ...defaultConfig, ...customConfig };

  const mermaidModule = await import("mermaid");
  const mermaid = mermaidModule.default;

  // Always reinitialize with the current config to support different configs per component
  mermaid.initialize(config);

  return mermaid;
};

type MermaidProps = {
  chart: string;
  className?: string;
  config?: MermaidConfig;
};

export const Mermaid = ({ chart, className, config }: MermaidProps) => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [svgContent, setSvgContent] = useState<string>("");
  const [lastValidSvg, setLastValidSvg] = useState<string>("");

  const { resolvedTheme } = useTheme();

  // biome-ignore lint/correctness/useExhaustiveDependencies: "Required for Mermaid"
  useEffect(() => {
    const renderChart = async () => {
      try {
        setError(null);
        setIsLoading(true);

        // Initialize mermaid with optional custom config
        const mermaid = await initializeMermaid({
          ...config,
          theme: resolvedTheme === "dark" ? "dark" : "default",
        });

        // Use a stable ID based on chart content hash and timestamp to ensure uniqueness
        const chartHash = chart.split("").reduce((acc, char) => {
          // biome-ignore lint/suspicious/noBitwiseOperators: "Required for Mermaid"
          return ((acc << SHIFT_5) - acc + char.charCodeAt(0)) | MAGIC_NUMBER;
        }, 0);
        const uniqueId = `mermaid-${Math.abs(chartHash)}-${Date.now()}-${Math.random().toString(ALPHANUMERIC_BASE).substring(2, RANDOM_STRING_LENGTH)}`;

        const { svg } = await mermaid.render(uniqueId, chart);

        // Update both current and last valid SVG
        setSvgContent(svg);
        setLastValidSvg(svg);
      } catch (err) {
        // Silently fail and keep the last valid SVG
        // Don't update svgContent here - just keep what we have

        // Only set error if we don't have any valid SVG
        if (!(lastValidSvg || svgContent)) {
          const errorMessage =
            err instanceof Error
              ? err.message
              : "Failed to render Mermaid chart";
          setError(errorMessage);
        }
      } finally {
        setIsLoading(false);
      }
    };

    renderChart();
  }, [chart, config, resolvedTheme]);

  // Show loading only on initial load when we have no content
  if (isLoading && !svgContent && !lastValidSvg) {
    return (
      <div className={cn("my-4 aspect-video p-4", className)}>
        <div className="flex size-full items-center justify-center">
          <SpinnerIcon className="size-4" />
        </div>
      </div>
    );
  }

  // Only show error if we have no valid SVG to display
  if (error && !svgContent && !lastValidSvg) {
    return (
      <div className={cn("bg-red-50 p-4", className)}>
        <p className="font-mono text-red-700 text-sm">Mermaid Error: {error}</p>
        <details className="mt-2">
          <summary className="cursor-pointer text-red-600 text-xs">
            Show Code
          </summary>
          <pre className="mt-2 overflow-x-auto rounded bg-red-100 p-2 text-red-800 text-xs">
            {chart}
          </pre>
        </details>
      </div>
    );
  }

  // Always render the SVG if we have content (either current or last valid)
  const displaySvg = svgContent || lastValidSvg;

  return (
    <div
      aria-label="Mermaid chart"
      className={cn("my-4 flex justify-center", className)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: "Required for Mermaid"
      dangerouslySetInnerHTML={{ __html: displaySvg }}
      role="img"
    />
  );
};
