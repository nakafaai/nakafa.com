"use client";

import { useTheme } from "next-themes";
import { useEffect, useId, useRef, useState } from "react";

export function Mermaid({ chart }: { chart: string }) {
  const id = useId();
  const [svg, setSvg] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const currentChartRef = useRef<string>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (currentChartRef.current === chart || !containerRef.current) {
      return;
    }
    const container = containerRef.current;
    currentChartRef.current = chart;

    async function renderChart() {
      const { default: mermaid } = await import("mermaid");

      try {
        // configure mermaid
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          fontFamily: "inherit",
          themeCSS: "margin: 1.5rem auto 0;",
          theme: resolvedTheme === "dark" ? "dark" : "default",
        });

        const { svg: svgString, bindFunctions } = await mermaid.render(
          id,
          chart.replaceAll("\\n", "\n")
        );

        bindFunctions?.(container);
        setSvg(svgString);
      } catch {
        // Silently fail if mermaid rendering fails
      }
    }

    renderChart();
  }, [chart, id, resolvedTheme]);

  // biome-ignore lint/security/noDangerouslySetInnerHtml: this is necessary
  return <div dangerouslySetInnerHTML={{ __html: svg }} ref={containerRef} />;
}
