import { getChartPayloadStringValue } from "@repo/design-system/components/evilcharts/ui/chart-payload";
import { describe, expect, it } from "@repo/testing/effect";

describe("chart payload utilities", () => {
  it("reads string fields from unknown payload values", () => {
    expect(getChartPayloadStringValue({ name: "Siswa" }, "name")).toBe("Siswa");
    expect(getChartPayloadStringValue({ name: 10 }, "name")).toBeUndefined();
    expect(getChartPayloadStringValue({ name: "Siswa" })).toBeUndefined();
    expect(getChartPayloadStringValue(["Siswa"], "0")).toBeUndefined();
    expect(getChartPayloadStringValue(null, "name")).toBeUndefined();
  });
});
