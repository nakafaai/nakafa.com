"use client";

import { captureException } from "@repo/analytics/posthog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "@repo/design-system/lib/utils";
import type { MermaidConfig } from "mermaid";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useId, useMemo, useRef, useState } from "react";

const HASH_SEED = 0;
const SHIFT_5 = 5;
const DEFAULT_MERMAID_IMAGE_SIZE = { width: 960, height: 540 };
const SVG_VIEWBOX_PATTERN = /\bviewBox="([^"]+)"/;
const SVG_VIEWBOX_PART_PATTERN = /\s+/;

/**
 * Loads Mermaid on the client and applies the site defaults before rendering.
 */
async function initializeMermaid(customConfig?: MermaidConfig) {
  const defaultConfig = {
    startOnLoad: false,
    theme: "default",
    securityLevel: "strict",
    fontFamily: "inherit",
    suppressErrorRendering: true,
  } satisfies MermaidConfig;

  const config = { ...defaultConfig, ...customConfig };

  const mermaidModule = await import("mermaid");
  const mermaid = mermaidModule.default;

  // Always reinitialize with the current config to support different configs per component
  mermaid.initialize(config);

  return mermaid;
}

/** Creates a stable Mermaid DOM id for one component instance and chart body. */
function getMermaidRenderId(componentId: string, chart: string) {
  const chartHash = chart.split("").reduce((acc, char) => {
    // biome-ignore lint/suspicious/noBitwiseOperators: Mermaid render ids only need a compact deterministic hash.
    return ((acc << SHIFT_5) - acc + char.charCodeAt(0)) | HASH_SEED;
  }, HASH_SEED);

  return `mermaid-${componentId.replaceAll(":", "")}-${Math.abs(chartHash).toString(36)}`;
}

/** Converts unknown Mermaid renderer failures into a user-visible message. */
function getMermaidRenderErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to render Mermaid chart";
}

/** Encodes Mermaid SVG output as an image source instead of live DOM markup. */
function createMermaidImageSource(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Reads the rendered SVG size so Next Image can preserve the diagram ratio. */
function readMermaidImageSize(svg: string) {
  const match = SVG_VIEWBOX_PATTERN.exec(svg);

  if (!match) {
    return DEFAULT_MERMAID_IMAGE_SIZE;
  }

  const parts = match[1].trim().split(SVG_VIEWBOX_PART_PATTERN);
  const width = Number(parts[2]);
  const height = Number(parts[3]);

  if (!(Number.isFinite(width) && Number.isFinite(height))) {
    return DEFAULT_MERMAID_IMAGE_SIZE;
  }

  if (width <= 0 || height <= 0) {
    return DEFAULT_MERMAID_IMAGE_SIZE;
  }

  return { width, height };
}

interface MermaidProps {
  chart: string;
  className?: string;
  config?: MermaidConfig;
  label: string;
}

/**
 * Renders Mermaid chart markup with a cached last-good SVG fallback.
 */
export const Mermaid = ({ chart, className, config, label }: MermaidProps) => {
  const componentId = useId();
  const { resolvedTheme } = useTheme();
  const renderId = getMermaidRenderId(componentId, chart);
  const theme =
    config?.theme ?? (resolvedTheme === "dark" ? "dark" : "default");
  const renderKey = `${renderId}-${theme}`;
  const [renderState, setRenderState] = useState({
    errorMessage: "",
    renderKey: "",
    svg: "",
  });
  const lastValidSvg = useRef("");

  useEffect(() => {
    let isCurrentRender = true;

    initializeMermaid({
      ...config,
      theme,
    })
      .then((mermaid) => mermaid.render(renderId, chart))
      .then(({ svg }) => {
        lastValidSvg.current = svg;
        return {
          errorMessage: "",
          renderKey,
          svg,
        };
      })
      .catch((error) => {
        const svg = lastValidSvg.current;

        captureException(error, {
          has_cached_svg: !!svg,
          source: "mermaid-render",
        });

        return {
          errorMessage: svg ? "" : getMermaidRenderErrorMessage(error),
          renderKey,
          svg,
        };
      })
      .then((nextRenderState) => {
        if (isCurrentRender) {
          setRenderState(nextRenderState);
        }
      });

    return () => {
      isCurrentRender = false;
    };
  }, [chart, config, renderId, renderKey, theme]);

  const hasCurrentRender = renderState.renderKey === renderKey;
  const svgSource = useMemo(
    () => createMermaidImageSource(renderState.svg),
    [renderState.svg]
  );
  const imageSize = useMemo(
    () => readMermaidImageSize(renderState.svg),
    [renderState.svg]
  );

  // Show loading only on initial load when we have no content
  if (!(hasCurrentRender || renderState.svg)) {
    return (
      <div className={cn("my-4 aspect-video p-4", className)}>
        <div className="flex size-full items-center justify-center">
          <Spinner />
        </div>
      </div>
    );
  }

  // Only show error if we have no valid SVG to display
  if (hasCurrentRender && renderState.errorMessage && !renderState.svg) {
    return (
      <div
        className={cn(
          "border border-destructive/20 bg-destructive/10 p-4",
          className
        )}
      >
        <p className="font-mono text-destructive text-sm">
          Mermaid Error: {renderState.errorMessage}
        </p>
        <details className="mt-2">
          <summary className="cursor-pointer text-destructive text-xs">
            Show Code
          </summary>
          <pre className="mt-2 overflow-x-auto rounded bg-destructive/10 p-2 text-destructive text-xs">
            {chart}
          </pre>
        </details>
      </div>
    );
  }

  // Always render the SVG if we have content (either current or last valid)
  return (
    <div className={cn("my-4 flex justify-center", className)}>
      <Image
        alt={label}
        className="h-auto max-w-full"
        height={imageSize.height}
        src={svgSource}
        unoptimized
        width={imageSize.width}
      />
    </div>
  );
};
