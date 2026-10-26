import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { createEditorView, tileAfter } from "@/components/tenant/exams/view";

const questionId = Schema.decodeUnknownSync(Id("examQuestions"));

describe("createEditorView", () => {
  it("starts on the pages, toggles the grid, and opens a tile back on the pages with its question to reveal", () => {
    const view = createEditorView();
    expect(view.getState()).toMatchObject({ mode: "pages", reveal: null });

    view.getState().toggleGrid();
    expect(view.getState().mode).toBe("grid");

    view.getState().open(questionId("q2"));
    expect(view.getState()).toMatchObject({
      mode: "pages",
      reveal: questionId("q2"),
    });

    view.getState().settle();
    expect(view.getState().reveal).toBeNull();

    view.getState().toggleGrid();
    view.getState().toggleGrid();
    expect(view.getState().mode).toBe("pages");
  });
});

describe("tileAfter", () => {
  const layout = { columns: 4, count: 10 };

  it("moves across, down and up the rows, and to the first and the last tile", () => {
    expect(tileAfter("ArrowRight", 2, layout)).toBe(3);
    expect(tileAfter("ArrowLeft", 2, layout)).toBe(1);
    expect(tileAfter("ArrowDown", 2, layout)).toBe(6);
    expect(tileAfter("ArrowUp", 6, layout)).toBe(2);
    expect(tileAfter("Home", 6, layout)).toBe(0);
    expect(tileAfter("End", 2, layout)).toBe(9);
  });

  it("stays on the nearest tile past an edge", () => {
    expect(tileAfter("ArrowLeft", 0, layout)).toBe(0);
    expect(tileAfter("ArrowDown", 8, layout)).toBe(9);
    expect(tileAfter("ArrowUp", 1, layout)).toBe(0);
  });
});
