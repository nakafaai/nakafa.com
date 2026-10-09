import {
  type ChartConfig,
  distributeColors,
  getChartColorVariableName,
  getColorsCount,
  THEMES,
} from "@repo/design-system/components/evilcharts/ui/chart-config";
import { Array as Arr, Record as Rec } from "effect";

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Arr.filter(
    Rec.toEntries(config),
    ([, itemConfig]) => !!itemConfig.colors
  );

  if (!colorConfig.length) {
    return null;
  }

  const generateCssVars = (theme: keyof typeof THEMES) =>
    Arr.join(
      Arr.flatMap(colorConfig, ([key, itemConfig]) => {
        const colorsArray = itemConfig.colors?.[theme];
        if (
          !(colorsArray && Arr.isArray(colorsArray)) ||
          colorsArray.length === 0
        ) {
          return [];
        }

        const maxCount = getColorsCount(itemConfig);
        const distributedColors = distributeColors(colorsArray, maxCount);

        return Arr.map(
          distributedColors,
          (color, index) =>
            `  ${getChartColorVariableName(key, index)}: ${color};`
        );
      }),
      "\n"
    );

  const css = Arr.join(
    Arr.map(
      Rec.toEntries(THEMES),
      ([theme, prefix]) =>
        `${prefix} [data-chart="${id}"] {\n${generateCssVars(theme as keyof typeof THEMES)}\n}`
    ),
    "\n"
  );

  return <style>{css}</style>;
}

export { ChartStyle };
