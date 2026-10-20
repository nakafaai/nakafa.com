import { describe, expect, it } from "@effect/vitest";
import { encodeJsonText, JsonTextSchema } from "@repo/utilities/json";
import { Option, Schema } from "effect";
import { Base64 } from "effect/encoding";
import {
  answerQueriesIn,
  changeAnswersIn,
  decodeGiven,
  decodeSent,
  encodeRefusal,
  failQueriesIn,
  isMutation,
  later,
  momentOf,
} from "./frames";

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

  it("reads the function and the arguments of a query the page adds, and the id of one it drops", () => {
    const added = {
      args: [{ paginationOpts: { cursor: null, numItems: 10 } }],
      queryId: 3,
      type: "Add",
      udfPath: "nina/messages:page",
    };
    const dropped = { queryId: 4, type: "Remove" };
    const frame = decodeSent(
      encodeJsonText({
        baseVersion: 1,
        modifications: [added, dropped],
        newVersion: 2,
        type: "ModifyQuerySet",
      })
    );

    expect(Option.getOrUndefined(frame)).toEqual({
      modifications: [added, dropped],
      type: "ModifyQuerySet",
    });
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

  it("turns the answer to a query into the failure of a function that threw, and keeps the rest of the transition as it was", () => {
    const failure = { _tag: "AuthReadError", code: "AUTH_READ_FAILED" };
    const versions = {
      endVersion: { identity: 2, querySet: 4, ts: "AgAAAAAAAAA=" },
      startVersion: { identity: 2, querySet: 3, ts: "AQAAAAAAAAA=" },
    };
    const answered = encodeJsonText({
      ...versions,
      modifications: [
        {
          journal: "j",
          logLines: [],
          queryId: 3,
          type: "QueryUpdated",
          value: "token",
        },
        {
          journal: null,
          logLines: [],
          queryId: 4,
          type: "QueryUpdated",
          value: 1,
        },
        { queryId: 5, type: "QueryRemoved" },
      ],
      type: "Transition",
    });

    const failed = failQueriesIn(answered, [3], failure).pipe(
      Option.map(Schema.decodeSync(JsonTextSchema)),
      Option.getOrUndefined
    );

    expect(failed).toEqual({
      ...versions,
      modifications: [
        {
          errorData: failure,
          errorMessage: "Refused by the test",
          journal: "j",
          logLines: [],
          queryId: 3,
          type: "QueryFailed",
        },
        {
          journal: null,
          logLines: [],
          queryId: 4,
          type: "QueryUpdated",
          value: 1,
        },
        { queryId: 5, type: "QueryRemoved" },
      ],
      type: "Transition",
    });
    // A transition that updates none of the queries, a query that was removed
    // and a frame that is no transition are left alone.
    const left = [
      [answered, [9]],
      [
        encodeJsonText({
          modifications: [{ queryId: 3, type: "QueryRemoved" }],
          type: "Transition",
        }),
        [3],
      ],
      [encodeJsonText({ type: "Ping" }), [3]],
    ] as const;
    for (const [frame, queryIds] of left) {
      expect(Option.isNone(failQueriesIn(frame, queryIds, failure))).toBe(true);
    }
  });

  it("reads the function and the arguments of each query the page adds, and the id of each it drops", () => {
    const change = decodeSent(
      encodeJsonText({
        modifications: [
          {
            args: [{ chatId: "c1", streamArgs: { kind: "list" } }],
            queryId: 1,
            type: "Add",
            udfPath: "nina/messages:page",
          },
          { queryId: 2, type: "Remove" },
        ],
        type: "ModifyQuerySet",
      })
    );

    expect(Option.getOrUndefined(change)).toEqual({
      modifications: [
        {
          args: [{ chatId: "c1", streamArgs: { kind: "list" } }],
          queryId: 1,
          type: "Add",
          udfPath: "nina/messages:page",
        },
        { queryId: 2, type: "Remove" },
      ],
      type: "ModifyQuerySet",
    });
  });

  it("puts the value of a function in place of whatever the server said of its query, and keeps the rest of the transition as it was", () => {
    const versions = {
      endVersion: { identity: 2, querySet: 4, ts: "AgAAAAAAAAA=" },
      startVersion: { identity: 2, querySet: 3, ts: "AQAAAAAAAAA=" },
    };
    const value = { turn: null };
    const said = encodeJsonText({
      ...versions,
      modifications: [
        {
          errorData: {},
          errorMessage: "Not stored",
          journal: "j",
          logLines: [],
          queryId: 3,
          type: "QueryFailed",
        },
        {
          journal: null,
          logLines: [],
          queryId: 4,
          type: "QueryUpdated",
          value: 1,
        },
        { queryId: 5, type: "QueryRemoved" },
      ],
      type: "Transition",
    });
    const valueFor = (queryId: number) =>
      queryId === 3 ? Option.some(value) : Option.none();

    const answered = answerQueriesIn(said, valueFor).pipe(
      Option.map(Schema.decodeSync(JsonTextSchema)),
      Option.getOrUndefined
    );

    expect(answered).toEqual({
      ...versions,
      modifications: [
        {
          journal: null,
          logLines: [],
          queryId: 3,
          type: "QueryUpdated",
          value,
        },
        {
          journal: null,
          logLines: [],
          queryId: 4,
          type: "QueryUpdated",
          value: 1,
        },
        { queryId: 5, type: "QueryRemoved" },
      ],
      type: "Transition",
    });
    // A transition that says nothing of the queries the function knows, and a
    // frame that is no transition, are left alone.
    expect(Option.isNone(answerQueriesIn(said, () => Option.none()))).toBe(
      true
    );
    expect(
      Option.isNone(
        answerQueriesIn(encodeJsonText({ type: "Ping" }), () =>
          Option.some(value)
        )
      )
    ).toBe(true);
  });

  it("changes what a query answers and keeps the rest of the transition as it was", () => {
    const versions = {
      endVersion: { identity: 2, querySet: 4, ts: "AgAAAAAAAAA=" },
      startVersion: { identity: 2, querySet: 3, ts: "AQAAAAAAAAA=" },
    };
    const answered = encodeJsonText({
      ...versions,
      modifications: [
        {
          journal: "j",
          logLines: [],
          queryId: 3,
          type: "QueryUpdated",
          value: { page: [1, 2], isDone: true },
        },
        {
          journal: null,
          logLines: [],
          queryId: 4,
          type: "QueryUpdated",
          value: { page: [3] },
        },
        { queryId: 5, type: "QueryRemoved" },
      ],
      type: "Transition",
    });
    const double = (value: unknown) => ({ answered: value, doubled: true });

    const changed = changeAnswersIn(answered, [3], double).pipe(
      Option.map(Schema.decodeSync(JsonTextSchema)),
      Option.getOrUndefined
    );

    expect(changed).toEqual({
      ...versions,
      modifications: [
        {
          journal: "j",
          logLines: [],
          queryId: 3,
          type: "QueryUpdated",
          value: { answered: { page: [1, 2], isDone: true }, doubled: true },
        },
        {
          journal: null,
          logLines: [],
          queryId: 4,
          type: "QueryUpdated",
          value: { page: [3] },
        },
        { queryId: 5, type: "QueryRemoved" },
      ],
      type: "Transition",
    });
    // A transition that updates none of the queries, a query that was removed
    // and a frame that is no transition are left alone.
    const removed = encodeJsonText({
      modifications: [{ queryId: 3, type: "QueryRemoved" }],
      type: "Transition",
    });
    const ping = encodeJsonText({ type: "Ping" });

    expect(Option.isNone(changeAnswersIn(answered, [9], double))).toBe(true);
    expect(Option.isNone(changeAnswersIn(removed, [3], double))).toBe(true);
    expect(Option.isNone(changeAnswersIn(ping, [3], double))).toBe(true);
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
  it("carries the typed failure a function threw in a refusal, and writes none for a server that broke", () => {
    const failure = { _tag: "NinaMemoryRejected", reason: "missing" };
    const broke: Parameters<typeof encodeRefusal>[0] = {
      logLines: [],
      requestId: 7,
      result: "Refused by the test",
      success: false,
      type: "MutationResponse",
    };
    const read = Schema.decodeSync(JsonTextSchema);

    expect(read(encodeRefusal({ ...broke, errorData: failure }))).toEqual({
      ...broke,
      errorData: failure,
    });
    expect(read(encodeRefusal({ ...broke, errorData: undefined }))).toEqual(
      broke
    );
    expect(encodeRefusal({ ...broke, errorData: undefined })).not.toContain(
      "errorData"
    );
  });

  it("decodes the FoldPending frame as a refused MutationResponse that stored no moment", () => {
    // The frame the server sends when a batch waits for a fold: nothing was written, so the
    // `ts` is null, and the typed failure is the one the editor decides on.
    const folding = decodeGiven(
      encodeJsonText({
        errorData: {
          _tag: "FoldPending",
          code: "FOLD_PENDING",
          message:
            "The steps of this document are being folded. Send the batch again shortly.",
        },
        logLines: [],
        requestId: 12,
        result: "Uncaught ConvexError",
        success: false,
        ts: null,
        type: "MutationResponse",
      })
    );

    expect(Option.getOrUndefined(folding)).toEqual({
      requestId: 12,
      success: false,
      ts: null,
      type: "MutationResponse",
    });
  });

  it("reads the success of an action's answer, so a refused action is a refusal", () => {
    const refused = decodeGiven(
      encodeJsonText({
        logLines: [],
        requestId: 3,
        result: "Refused by the server",
        success: false,
        type: "ActionResponse",
      })
    );

    expect(Option.getOrUndefined(refused)).toEqual({
      success: false,
      type: "ActionResponse",
    });
  });
});
