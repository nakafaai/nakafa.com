"use client";

import { createContext, type ReactNode, use } from "react";

/** One series of a chart, with the label and the color its legend shows. */
interface ChartSeries {
  /** The color that the series has in the chart, when the chart gives it one. */
  color?: string | undefined;
  key: string;
  label: ReactNode;
  /** The value of the series in each category, in the order of the categories. */
  values: readonly number[];
}

/** The categories and the series that one chart card draws, which its footer reads. */
export interface ChartData {
  categories: readonly string[];
  series: readonly ChartSeries[];
}

const ChartDataContext = createContext<ChartData | null>(null);

/** Provides one chart card's data to its footer. */
export function ChartDataProvider({
  children,
  data,
}: {
  children: ReactNode;
  data: ChartData;
}) {
  return <ChartDataContext value={data}>{children}</ChartDataContext>;
}

/** Reads the data of the surrounding chart card. */
export function useChartData() {
  const data = use(ChartDataContext);
  if (!data) {
    // A missing provider is a programmer composition error at this React seam.
    throw new Error("useChartData must be used within ChartDataProvider");
  }
  return data;
}
