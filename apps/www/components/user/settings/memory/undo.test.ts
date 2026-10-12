import { describe, expect, it } from "@effect/vitest";
import { createUndo } from "@/components/user/settings/memory/undo";

describe("the Undo of a deletion", () => {
  it("writes the memory back at once when the server already deleted it", () => {
    const restore = vi.fn();
    const undo = createUndo(restore);

    undo.deleted();
    expect(restore).not.toHaveBeenCalled();
    undo.press();
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it("waits for the server when it is pressed while the deletion is on its way, and writes the memory back once", () => {
    const restore = vi.fn();
    const undo = createUndo(restore);

    undo.press();
    expect(restore).not.toHaveBeenCalled();
    undo.deleted();
    undo.deleted();
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it("writes nothing when the server kept the memory, whether the press came before the answer or after", () => {
    const early = vi.fn();
    const pressedFirst = createUndo(early);
    pressedFirst.press();
    pressedFirst.kept();
    expect(early).not.toHaveBeenCalled();

    const late = vi.fn();
    const answeredFirst = createUndo(late);
    answeredFirst.kept();
    answeredFirst.press();
    expect(late).not.toHaveBeenCalled();
  });
});
