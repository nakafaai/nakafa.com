import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { createExamEditing } from "@/components/tenant/exams/editing";
import { emptyDraft } from "@/components/tenant/exams/figure/draft";

describe("createExamEditing", () => {
  it("starts with no active editor and no picture waiting", () => {
    const store = createExamEditing<{ name: string }>();

    expect(store.getState().active).toBeNull();
    expect(store.getState().pictures).toEqual([]);
  });

  it("keeps the last editor that took focus, when the focus leaves it", () => {
    const store = createExamEditing<{ name: string }>();
    const prompt = { name: "prompt" };
    const option = { name: "option" };

    store.getState().activate(prompt);
    store.getState().activate(option);

    expect(store.getState().active).toBe(option);
  });

  it("gives up its place only when the removed editor is the active one", () => {
    const store = createExamEditing<{ name: string }>();
    const prompt = { name: "prompt" };
    const option = { name: "option" };

    store.getState().activate(prompt);
    store.getState().release(option);
    expect(store.getState().active).toBe(prompt);

    store.getState().release(prompt);
    expect(store.getState().active).toBeNull();
  });

  it("queues pictures in order and takes the first one out", () => {
    const store = createExamEditing<{ name: string }>();
    const editor = { name: "prompt" };
    const first = new File(["a"], "first.png", { type: "image/png" });
    const second = new File(["b"], "second.png", { type: "image/png" });

    store.getState().queuePicture({ editor, file: first });
    store.getState().queuePicture({ editor, file: second });
    expect(
      Arr.map(store.getState().pictures, (picture) => picture.file)
    ).toEqual([first, second]);

    store.getState().shiftPicture();
    expect(
      Arr.map(store.getState().pictures, (picture) => picture.file)
    ).toEqual([second]);
  });

  it("holds the figure the dialog writes until it closes", () => {
    const store = createExamEditing<object>();
    const figure = {
      draft: emptyDraft("graph"),
      editor: {},
      position: null,
    };

    store.getState().openFigure(figure);
    expect(store.getState().figure).toBe(figure);
    store.getState().closeFigure();
    expect(store.getState().figure).toBeNull();
  });
});
