import { describe, expect, it } from "@effect/vitest";
import { createUndo } from "@/components/user/settings/memory/undo";

describe("the Undo of a deletion", () => {
  it("puts the memory back at once when the server already deleted it", () => {
    const restore = vi.fn();
    const undo = createUndo(restore, vi.fn());

    undo.deleted();
    expect(restore).not.toHaveBeenCalled();
    undo.press();
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it("waits for the server when it is pressed while the deletion is on its way", () => {
    const restore = vi.fn();
    const undo = createUndo(restore, vi.fn());

    undo.press();
    expect(restore).not.toHaveBeenCalled();
    undo.deleted();
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it("puts the memory back once, however often the learner presses Undo and whenever the server answers", () => {
    const answered = vi.fn();
    const afterTheAnswer = createUndo(answered, vi.fn());
    afterTheAnswer.deleted();
    afterTheAnswer.press();
    afterTheAnswer.press();
    expect(answered).toHaveBeenCalledTimes(1);

    const waiting = vi.fn();
    const beforeTheAnswer = createUndo(waiting, vi.fn());
    beforeTheAnswer.press();
    beforeTheAnswer.press();
    beforeTheAnswer.deleted();
    beforeTheAnswer.press();
    expect(waiting).toHaveBeenCalledTimes(1);
  });

  it("puts nothing back when the server kept the memory, whether the press came before the answer or after", () => {
    const early = vi.fn();
    const pressedFirst = createUndo(early, vi.fn());
    pressedFirst.press();
    pressedFirst.kept();
    expect(early).not.toHaveBeenCalled();

    const late = vi.fn();
    const answeredFirst = createUndo(late, vi.fn());
    answeredFirst.kept();
    answeredFirst.press();
    expect(late).not.toHaveBeenCalled();
  });

  it("keeps the words until the server has answered, and lets them go once it deleted the memory, pressed or not", () => {
    const unpressed = vi.fn();
    const quiet = createUndo(vi.fn(), unpressed);

    expect(unpressed).not.toHaveBeenCalled();
    quiet.deleted();
    expect(unpressed).toHaveBeenCalledTimes(1);

    const pressed = vi.fn();
    const eager = createUndo(vi.fn(), pressed);

    eager.press();
    expect(pressed).not.toHaveBeenCalled();
    eager.deleted();
    expect(pressed).toHaveBeenCalledTimes(1);
  });

  it("never lets the words go for a memory the server kept, because the page gives them back", () => {
    const release = vi.fn();
    const undo = createUndo(vi.fn(), release);

    undo.kept();
    expect(release).not.toHaveBeenCalled();
  });
});
