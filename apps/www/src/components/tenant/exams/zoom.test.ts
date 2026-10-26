import { expect, it } from "@effect/vitest";
import {
  createExamZoom,
  drawnZoom,
  PAGE_WIDTH,
  sliderPosition,
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEPS,
  zoomAt,
} from "@/components/tenant/exams/zoom";

it("spans the zoom from its smallest to its largest value", () => {
  expect(zoomAt(0)).toBe(ZOOM_MIN);
  expect(zoomAt(ZOOM_STEPS)).toBe(ZOOM_MAX);
});

it("keeps the nearest zoom for a slider position past either end", () => {
  expect(zoomAt(-5)).toBe(ZOOM_MIN);
  expect(zoomAt(ZOOM_STEPS + 5)).toBe(ZOOM_MAX);
});

it("maps a zoom to a slider position and back to the same zoom", () => {
  for (const percent of [50, 75, ZOOM_DEFAULT, 150, 200]) {
    expect(zoomAt(sliderPosition(percent))).toBe(percent);
  }
});

it("starts the pages fitted at the default zoom, takes a new zoom at once, and fits or fills again", () => {
  const zoom = createExamZoom();
  expect(zoom.getState()).toMatchObject({ mode: "fit", percent: ZOOM_DEFAULT });

  zoom.getState().set(150);
  expect(zoom.getState()).toMatchObject({ mode: "percent", percent: 150 });

  zoom.getState().fit("fill");
  expect(zoom.getState()).toMatchObject({ mode: "fill", percent: 150 });
});

it("draws a fitted page at its own width, a chosen zoom as chosen, and a filled page across the canvas", () => {
  const canvasWidth = PAGE_WIDTH * 1.5;
  expect(drawnZoom({ canvasWidth, mode: "fit", percent: 150 })).toBe(ZOOM_DEFAULT);
  expect(drawnZoom({ canvasWidth, mode: "percent", percent: 75 })).toBe(75);
  expect(drawnZoom({ canvasWidth, mode: "fill", percent: 75 })).toBe(150);
});

it("keeps a filled page within the zooms the editor allows, and at the default before the canvas is measured", () => {
  expect(drawnZoom({ canvasWidth: 5000, mode: "fill", percent: 100 })).toBe(ZOOM_MAX);
  expect(drawnZoom({ canvasWidth: 200, mode: "fill", percent: 100 })).toBe(ZOOM_MIN);
  expect(drawnZoom({ canvasWidth: 0, mode: "fill", percent: 100 })).toBe(ZOOM_DEFAULT);
});

it("keeps the width the canvas measured for Fill", () => {
  const zoom = createExamZoom();
  zoom.getState().measure(1000);
  expect(zoom.getState().canvasWidth).toBe(1000);
});

it("spaces the zoom on a logarithmic scale, so each step scales the pages alike", () => {
  expect(zoomAt(ZOOM_STEPS / 2)).toBe(
    Math.round(Math.sqrt(ZOOM_MIN * ZOOM_MAX))
  );
});
