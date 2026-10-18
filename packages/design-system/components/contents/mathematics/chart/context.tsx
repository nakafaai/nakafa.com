"use client";

import { Schema } from "effect";
import { createContext, type ReactNode, use } from "react";

/** One series of a chart, with the name and the color its legend shows. */
const ChartSeriesSchema = Schema.Struct({
  /** The color that the series has in the chart, when the chart gives it one. */
  color: Schema.optional(Schema.String),
  key: Schema.String,
  /** The name of the series, which its legend and its footer show. */
  label: Schema.String,
  /** The value of the series in each category, in the order of the categories. */
  values: Schema.Array(Schema.Finite),
});

/** The categories and the series that one chart card draws, which its footer reads. */
const ChartDataSchema = Schema.Struct({
  categories: Schema.Array(Schema.String),
  series: Schema.Array(ChartSeriesSchema),
});

/** The data of one chart card: its categories and its series. */
export type ChartData = typeof ChartDataSchema.Type;

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
