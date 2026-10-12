import { describe, expect, it } from "@effect/vitest";
import { createUndo } from "@/components/user/settings/memory/undo";

describe("the Undo of a deletion", () => {
  it("writes the memory back at once when the server already deleted it", () => {
    const restore = vi.fn();
    const undo = createUndo(restore, vi.fn());

    undo.deleted();
    expect(restore).not.toHaveBeenCalled();
    undo.press();
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it("waits for the server when it is pressed while the deletion is on its way, and writes the memory back once", () => {
    const restore = vi.fn();
    const undo = createUndo(restore, vi.fn());

    undo.press();
    expect(restore).not.toHaveBeenCalled();
    undo.deleted();
    undo.deleted();
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it("writes nothing when the server kept the memory, whether the press came before the answer or after", () => {
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

  it("keeps the words while the server has not answered, though the offer ended, and lets them go once the server deleted the memory", () => {
    const release = vi.fn();
    const undo = createUndo(vi.fn(), release);

    undo.closed();
    expect(release).not.toHaveBeenCalled();
    undo.deleted();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("keeps the words after the server deleted the memory for as long as the Undo is offered", () => {
    const release = vi.fn();
    const undo = createUndo(vi.fn(), release);

    undo.deleted();
    expect(release).not.toHaveBeenCalled();
    undo.closed();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("never lets the words go for a memory the server kept, because the page gives them back", () => {
    const release = vi.fn();
    const undo = createUndo(vi.fn(), release);

    undo.closed();
    undo.kept();
    expect(release).not.toHaveBeenCalled();
  });
});
