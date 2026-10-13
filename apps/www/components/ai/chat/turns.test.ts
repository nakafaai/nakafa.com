import { describe, expect, it } from "@effect/vitest";
import type { NinaTurnSummary } from "@repo/backend/confect/nina/contract/turn";
import { turnOf, turnsByOrder } from "@/components/ai/chat/turns";

/** A turn that answers the prompt at `order`, as the conversation tells it. */
function turn(
  order: number,
  state: (typeof NinaTurnSummary.Type)["state"] = {
    finishedAt: order,
    status: "complete",
  }
): typeof NinaTurnSummary.Type {
  return { order, promptMessageId: `prompt-${order}`, state, usage: [] };
}

describe("chat/turns", () => {
  const ended = turnsByOrder([turn(0), turn(1)]);

  it("tells the turn that ended for the prompt at an order", () => {
    expect(turnOf(turn(2), ended, 1)).toEqual(turn(1));
    expect(turnOf(null, ended, 0)).toEqual(turn(0));
  });

  it("tells the latest turn as the conversation has it, over the one that ended", () => {
    const stopped = turn(1, { finishedAt: 5, status: "cancelled" });

    expect(turnOf(stopped, ended, 1)).toBe(stopped);
    expect(turnOf(turn(2, { status: "queued" }), ended, 2)).toEqual(
      turn(2, { status: "queued" })
    );
  });

  it("tells no turn for a prompt that has none yet, such as the one just sent", () => {
    expect(turnOf(turn(1), ended, 2)).toBeUndefined();
    expect(turnOf(null, turnsByOrder([]), 0)).toBeUndefined();
  });
});
