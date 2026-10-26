import { describe, expect, it } from "@effect/vitest";
import {
  type Acknowledged,
  audit,
  type StoredAnswer,
} from "@repo/backend/scripts/load/ledger";

/** One answer of attempt `a1`, with its question, version and option. */
const answer = (
  question: string,
  version: number,
  option = "option-1"
): Acknowledged & StoredAnswer => ({
  attempt: "a1",
  question,
  response: [option],
  version,
});

describe("load ledger", () => {
  it("keeps an answer stored at its latest acknowledged version and options", () => {
    expect(
      audit(
        [answer("q1", 1), answer("q1", 2, "option-3"), answer("q2", 1)],
        [answer("q1", 2, "option-3"), answer("q2", 1)]
      )
    ).toEqual({
      acknowledged: 2,
      ahead: 0,
      duplicated: 0,
      lost: 0,
      mismatched: 0,
      stored: 2,
      unacknowledged: 0,
    });
  });

  it("counts an acknowledged answer that is missing or stored older as lost", () => {
    expect(
      audit([answer("q1", 2), answer("q2", 1)], [answer("q1", 1)])
    ).toMatchObject({ lost: 2 });
  });

  it("counts other options at the acknowledged version as mismatched", () => {
    expect(
      audit([answer("q1", 1, "option-1")], [answer("q1", 1, "option-2")])
    ).toMatchObject({ lost: 0, mismatched: 1 });
  });

  it("counts a newer stored version as ahead, a write that landed while its student was away", () => {
    expect(audit([answer("q1", 1)], [answer("q1", 2)])).toMatchObject({
      ahead: 1,
      lost: 0,
    });
  });

  it("counts every second row of one question as a duplicate, and a stored question nobody was told about", () => {
    expect(
      audit(
        [answer("q1", 1)],
        [answer("q1", 1), answer("q1", 1), answer("q9", 1)]
      )
    ).toMatchObject({ duplicated: 1, stored: 3, unacknowledged: 1 });
  });
});
