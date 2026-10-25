import { expect, it } from "@effect/vitest";
import {
  createExamZoom,
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

it("starts the pages at the default zoom, and takes a new zoom at once", () => {
  const zoom = createExamZoom();
  expect(zoom.getState().percent).toBe(ZOOM_DEFAULT);

  zoom.getState().set(150);
  expect(zoom.getState().percent).toBe(150);
});

it("spaces the zoom on a logarithmic scale, so each step scales the pages alike", () => {
  expect(zoomAt(ZOOM_STEPS / 2)).toBe(
    Math.round(Math.sqrt(ZOOM_MIN * ZOOM_MAX))
  );
});
