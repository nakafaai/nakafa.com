import {
  type ChartConfig,
  distributeColors,
  getChartColorVariableName,
  getColorsCount,
  THEMES,
} from "@repo/design-system/components/evilcharts/ui/chart-config";

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(
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
          !(colorsArray && Array.isArray(colorsArray)) ||
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

  const css = Object.entries(THEMES)
    .map(
      ([theme, prefix]) =>
        `${prefix} [data-chart="${id}"] {\n${generateCssVars(theme as keyof typeof THEMES)}\n}`
    )
    .join("\n");

  return <style>{css}</style>;
}

export { ChartStyle };
