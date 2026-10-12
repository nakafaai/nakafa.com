import { describe, expect, it } from "@effect/vitest";
import { encodeJsonText } from "@repo/utilities/json";
import { Option } from "effect";
import { Base64 } from "effect/encoding";
import {
  decodeGiven,
  decodeSent,
  encodeRefusal,
  isMutation,
  later,
  momentOf,
} from "@/e2e/support/frames";

/** A call to a function of the backend, as the page sends it. */
const call = (type: "Action" | "Mutation", udfPath: string) =>
  encodeJsonText({ args: [{}], requestId: 7, type, udfPath });

describe("the frames of the realtime connection", () => {
  it("follows an action the page asks for as it follows a mutation, and fails only a mutation", () => {
    const upload = decodeSent(call("Action", "nina/uploads:save"));
    const rename = decodeSent(
      call("Mutation", "chats/mutations:updateChatTitle")
    );

    expect(Option.getOrUndefined(upload)).toMatchObject({
      type: "Action",
      udfPath: "nina/uploads:save",
    });
    expect(Option.getOrUndefined(rename)).toMatchObject({
      type: "Mutation",
      udfPath: "chats/mutations:updateChatTitle",
    });
    expect(Option.isNone(Option.filter(upload, isMutation))).toBe(true);
    expect(Option.isSome(Option.filter(rename, isMutation))).toBe(true);
  });

  it("leaves a frame the tracker does not follow undecoded", () => {
    const event = encodeJsonText({ event: {}, eventType: "x", type: "Event" });

    expect(Option.isNone(decodeSent(event))).toBe(true);
    expect(Option.isNone(decodeGiven(event))).toBe(true);
  });

  it("reads the answer to an action and the moment a mutation was stored", () => {
    const stored = decodeGiven(
      encodeJsonText({
        requestId: 7,
        success: true,
        ts: Base64.encode(new Uint8Array([2, 1, 0, 0, 0, 0, 0, 0])),
        type: "MutationResponse",
      })
    );
    const acted = decodeGiven(encodeJsonText({ type: "ActionResponse" }));

    expect(Option.getOrUndefined(acted)).toEqual({ type: "ActionResponse" });
    // The moment is eight bytes, the least significant first.
    const moment = stored.pipe(
      Option.flatMap((frame) =>
        frame.type === "MutationResponse"
          ? Option.fromNullishOr(frame.ts)
          : Option.none()
      ),
      Option.map(momentOf)
    );
    expect(moment).toEqual(Option.some(258n));
  });

  it("reads what an updated query now answers, and nothing for one that was removed", () => {
    const transition = decodeGiven(
      encodeJsonText({
        endVersion: {
          ts: Base64.encode(new Uint8Array([2, 1, 0, 0, 0, 0, 0, 0])),
        },
        modifications: [
          { queryId: 3, type: "QueryUpdated", value: { turn: { order: 1 } } },
          { queryId: 4, type: "QueryRemoved" },
        ],
        type: "Transition",
      })
    );

    expect(
      transition.pipe(
        Option.map((frame) =>
          frame.type === "Transition" ? frame.modifications : []
        ),
        Option.getOrUndefined
      )
    ).toEqual([
      { queryId: 3, type: "QueryUpdated", value: { turn: { order: 1 } } },
      { queryId: 4, type: "QueryRemoved" },
    ]);
  });

  it("keeps the later of two moments", () => {
    expect(later(258n, 3n)).toBe(258n);
    expect(later(3n, 258n)).toBe(258n);
  });

  it("words a refusal the way the protocol words the answer of a server", () => {
    const refusal = {
      logLines: [],
      requestId: 7,
      result: "Refused by the test",
      success: false,
      type: "MutationResponse",
    } as const;

    expect(encodeRefusal(refusal)).toBe(encodeJsonText(refusal));
  });
});
