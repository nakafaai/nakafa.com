import {
  axisValueToPercentFormatter,
  type ChartConfig,
  distributeColors,
  getChartColorVariable,
  getChartColorVariableName,
  getChartSeriesId,
  getChartSeriesPaint,
  getColorsCount,
  getLoadingData,
  getPayloadConfigEntry,
  THEMES,
  validateChartConfigColors,
} from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  getChartPayloadStringValue,
  isChartPayloadRecord,
} from "@repo/design-system/components/evilcharts/ui/chart-payload";
import { afterEach, describe, expect, it, vi } from "vitest";

const chartConfig = {
  selected: {
    label: "Selected motion",
    colors: {
      light: ["var(--chart-1)"],
      dark: ["var(--chart-1)"],
    },
  },
  motion: {
    label: "Context motion",
  },
} satisfies ChartConfig;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("chart config utilities", () => {
  it("exposes the light and dark theme selectors", () => {
    expect(THEMES).toEqual({
      light: "",
      dark: ".dark",
    });
  });

  it("validates runtime color config shapes", () => {
    expect(() =>
      validateChartConfigColors({
        motion: {},
        selected: {
          colors: {
            light: ["var(--chart-1)"],
          },
        },
      })
    ).not.toThrow();

    const invalidConfig = {
      selected: {
        colors: {
          neon: ["var(--chart-1)"],
        },
      },
    };

    expect(() => validateChartConfigColors(invalidConfig)).toThrow(
      'Invalid chart config for "selected"'
    );

    expect(() =>
      validateChartConfigColors({
        selected: {
          colors: {},
        },
      })
    ).toThrow('Invalid chart config for "selected"');
  });

  it("distributes color stops across requested slots", () => {
    expect(distributeColors(["red", "blue"], 4)).toEqual([
      "red",
      "red",
      "blue",
      "blue",
    ]);
    expect(distributeColors(["red", "pink", "blue"], 4)).toEqual([
      "red",
      "pink",
      "blue",
      "blue",
    ]);
    expect(distributeColors(["red", "pink", "blue"], 2)).toEqual([
      "red",
      "pink",
    ]);
  });

  it("builds stable CSS variables and SVG identifiers", () => {
    expect(getChartColorVariableName("speed", 0)).toBe("--color-speed-0");
    expect(getChartColorVariableName("v (m/s)", 2)).toBe(
      "--color-v_20__28_m_2f_s_29_-2"
    );
    expect(getChartColorVariable("speed", 1)).toBe("var(--color-speed-1)");
    expect(getChartColorVariable("speed", 1, 0)).toBe(
      "var(--color-speed-1, var(--color-speed-0))"
    );
    expect(getChartSeriesId("chart", "line", "speed")).toBe("chart-line-speed");
  });

  it("uses solid paint for one color and a paint server for gradients", () => {
    expect(getChartSeriesPaint("chart", "line", "speed", 1)).toBe(
      "var(--color-speed-0)"
    );
    expect(getChartSeriesPaint("chart", "line", "speed", 2)).toBe(
      "url(#chart-line-speed)"
    );
  });

  it("counts configured color stops across themes", () => {
    expect(getColorsCount({ label: "Plain" })).toBe(1);
    expect(
      getColorsCount({
        colors: {
          light: ["red", "pink"],
          dark: ["blue"],
        },
      })
    ).toBe(2);
    expect(
      getColorsCount({
        colors: {
          dark: ["blue"],
        },
      })
    ).toBe(1);
  });

  it("formats expanded axis values as rounded percentages", () => {
    expect(axisValueToPercentFormatter(0.456)).toBe("46%");
  });

  it("creates deterministic loading data when randomness is controlled", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    expect(getLoadingData(2, 10, 20)).toEqual([
      { loading: 15 },
      { loading: 15 },
    ]);
    expect(getLoadingData(1)).toEqual([{ loading: 35 }]);
    expect(getLoadingData()).toHaveLength(10);
  });
});

describe("chart payload utilities", () => {
  it("narrows unknown payload values to records", () => {
    expect(isChartPayloadRecord({ value: 1 })).toBe(true);
    expect(isChartPayloadRecord(null)).toBe(false);
    expect(isChartPayloadRecord("value")).toBe(false);
  });

  it("reads string fields from unknown payload values", () => {
    expect(getChartPayloadStringValue({ name: "Siswa" }, "name")).toBe("Siswa");
    expect(getChartPayloadStringValue({ name: 10 }, "name")).toBeUndefined();
    expect(getChartPayloadStringValue({ name: "Siswa" })).toBeUndefined();
    expect(getChartPayloadStringValue(null, "name")).toBeUndefined();
  });
});

describe("chart config payload resolution", () => {
  it("prefers the payload data key over a localized display name", () => {
    const entry = getPayloadConfigEntry(
      chartConfig,
      {
        dataKey: "selected",
        name: "Makin cepat",
        payload: {
          selected: 18,
          time: 4,
        },
      },
      "Makin cepat"
    );

    expect(entry).toEqual({
      config: chartConfig.selected,
      dataKey: "selected",
    });
  });

  it("falls back to the provided key when no payload data key is present", () => {
    const entry = getPayloadConfigEntry(chartConfig, {}, "motion");

    expect(entry).toEqual({
      config: chartConfig.motion,
      dataKey: "motion",
    });
  });

  it("falls back to the provided key when payload is not an object", () => {
    const entry = getPayloadConfigEntry(chartConfig, null, "motion");

    expect(entry).toEqual({
      config: chartConfig.motion,
      dataKey: "motion",
    });
  });

  it("uses a payload string value when the key itself is not configured", () => {
    const entry = getPayloadConfigEntry(
      chartConfig,
      {
        name: "selected",
      },
      "name"
    );

    expect(entry).toEqual({
      config: chartConfig.selected,
      dataKey: "selected",
    });
  });

  it("uses a nested payload string value when available", () => {
    const entry = getPayloadConfigEntry(
      chartConfig,
      {
        payload: {
          name: "motion",
        },
      },
      "name"
    );

    expect(entry).toEqual({
      config: chartConfig.motion,
      dataKey: "motion",
    });
  });

  it("returns undefined when no payload value resolves to config", () => {
    expect(
      getPayloadConfigEntry(
        chartConfig,
        {
          dataKey: 42,
          name: 10,
          payload: 1,
        },
        "missing"
      )
    ).toBeUndefined();
    expect(
      getPayloadConfigEntry(
        chartConfig,
        {
          payload: {
            name: 10,
          },
        },
        "missing"
      )
    ).toBeUndefined();
  });
});
