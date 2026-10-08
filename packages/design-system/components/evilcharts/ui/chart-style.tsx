import {
  type ChartConfig,
  distributeColors,
  getChartColorVariableName,
  getColorsCount,
  THEMES,
} from "@repo/design-system/components/evilcharts/ui/chart-config";
import { Array as Arr, Record as Rec } from "effect";

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Rec.toEntries(config).filter(
    ([, itemConfig]) => itemConfig.colors
  );

  if (!colorConfig.length) {
    return null;
  }

  const generateCssVars = (theme: keyof typeof THEMES) =>
    colorConfig
      .flatMap(([key, itemConfig]) => {
        const colorsArray = itemConfig.colors?.[theme];
        if (
          !(colorsArray && Arr.isArray(colorsArray)) ||
          colorsArray.length === 0
        ) {
          return [];
        }

        const maxCount = getColorsCount(itemConfig);
        const distributedColors = distributeColors(colorsArray, maxCount);

        return distributedColors.map(
          (color, index) =>
            `  ${getChartColorVariableName(key, index)}: ${color};`
        );
      })
      .join("\n");

  const css = Rec.toEntries(THEMES)
    .map(
      ([theme, prefix]) =>
        `${prefix} [data-chart="${id}"] {\n${generateCssVars(theme as keyof typeof THEMES)}\n}`
    )
    .join("\n");

  return <style>{css}</style>;
}

export { ChartStyle };
