import { describe, expect, it } from "@effect/vitest";
import { DocumentInvalid } from "@repo/backend/confect/editor/document";
import { Effect, Fiber, Ref } from "effect";
import { TestClock } from "effect/testing";
import { reportClientException } from "@/lib/analytics/client";
import { closeEditor } from "@/lib/editor/close";
import { SyncFailed, type SyncTransport } from "@/lib/editor/session";
import { startSync } from "@/lib/editor/sync";
import {
  foldingServer,
  makePort,
  makeServer,
  type Refusal,
  silentEditor,
  typeText,
} from "@/test/sync";

vi.mock("@/lib/analytics/client", async () => {
  const { Effect: Eff } = await import("effect");
  return { reportClientException: vi.fn(() => Eff.void) };
});

const SOURCE = "components/tenant/exams/text";

/** A transport whose reads of the server's steps are counted, so a test sees each round. */
const countingReads = (transport: SyncTransport) =>
  Effect.map(Ref.make(0), (reads) => ({
    reads,
    transport: {
      ...transport,
      since: (clientId: string, version: number) =>
        Ref.update(reads, (count) => count + 1).pipe(
          Effect.andThen(transport.since(clientId, version))
        ),
    },
  }));

describe("closeEditor", () => {
  it.effect(
    "sends the steps an editor typed before it closed, and the server takes them",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const { port, state } = yield* makePort();
        const session = yield* startSync(port, server.transport);
        yield* typeText(state, "abc");

        yield* closeEditor(session, Ref.get(state), SOURCE);

        expect(yield* server.counts).toMatchObject({ head: 1, submits: 1 });
      })
  );

  it.effect("makes no round when the editor holds no step", () =>
    Effect.gen(function* () {
      const server = yield* makeServer();
      const { port, state } = yield* makePort();
      const session = yield* startSync(port, server.transport);
      const counted = yield* countingReads(session.transport);

      yield* closeEditor(
        { ...session, transport: counted.transport },
        Ref.get(state),
        SOURCE
      );

      expect(yield* Ref.get(counted.reads)).toBe(0);
    })
  );

  it.effect(
    "runs at most three rounds while the server never answers the steps",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const { port, state } = yield* makePort();
        const opened = yield* startSync(port, server.transport);
        yield* typeText(state, "abc");
        const counted = yield* countingReads(
          silentEditor(server, opened).transport
        );

        yield* closeEditor(
          { ...opened, transport: counted.transport },
          Ref.get(state),
          SOURCE
        );

        expect(yield* Ref.get(counted.reads)).toBe(3);
      })
  );

  it.effect("reports a round that fails, and stops there", () =>
    Effect.gen(function* () {
      vi.mocked(reportClientException).mockClear();
      const server = yield* makeServer();
      const { port, state } = yield* makePort();
      const opened = yield* startSync(port, server.transport);
      yield* typeText(state, "abc");
      const offline: SyncTransport = {
        ...server.transport,
        submit: () =>
          Effect.fail(new SyncFailed({ reason: "The network is down." })),
      };
      const counted = yield* countingReads(offline);

      yield* closeEditor(
        { ...opened, transport: counted.transport },
        Ref.get(state),
        SOURCE
      );

      expect(yield* Ref.get(counted.reads)).toBe(1);
      expect(reportClientException).toHaveBeenCalledWith(
        expect.objectContaining({ _tag: "SyncFailed" }),
        { source: SOURCE }
      );
    })
  );

  it.effect(
    "reports the steps the server refused and the flush dropped, once",
    () =>
      Effect.gen(function* () {
        vi.mocked(reportClientException).mockClear();
        const refuseAll: Refusal = () => Effect.fail(new DocumentInvalid());
        const server = yield* makeServer(undefined, refuseAll);
        const { port, state } = yield* makePort();
        const session = yield* startSync(port, server.transport);
        yield* typeText(state, "a");

        yield* closeEditor(session, Ref.get(state), SOURCE);

        expect(reportClientException).toHaveBeenCalledTimes(1);
        expect(reportClientException).toHaveBeenCalledWith(
          expect.objectContaining({ _tag: "SyncDropped", count: 1 }),
          { source: SOURCE }
        );
      })
  );

  it.effect(
    "keeps the steps through a fold on the cadence, and reports nothing once the server takes them",
    () =>
      Effect.gen(function* () {
        vi.mocked(reportClientException).mockClear();
        const { server } = yield* foldingServer(7);
        const { port, state } = yield* makePort();
        const session = yield* startSync(port, server.transport);
        yield* typeText(state, "abc");

        // The first round ends its short waits at 11.75 seconds. The cadence runs it again four
        // seconds later, when the fold has ended, so the server takes the batch.
        const flush = yield* closeEditor(session, Ref.get(state), SOURCE).pipe(
          Effect.forkChild
        );
        yield* TestClock.adjust("16 seconds");
        yield* Fiber.join(flush);

        expect(yield* server.counts).toMatchObject({ head: 1, submits: 1 });
        expect(reportClientException).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "reports the fold once when the close budget ends, and leaves the steps unsent",
    () =>
      Effect.gen(function* () {
        vi.mocked(reportClientException).mockClear();
        const { server } = yield* foldingServer(Number.POSITIVE_INFINITY);
        const { port, state } = yield* makePort();
        const session = yield* startSync(port, server.transport);
        yield* typeText(state, "abc");

        // The budget is ten minutes, and the last round of the flush ends within a minute of it.
        const flush = yield* closeEditor(session, Ref.get(state), SOURCE).pipe(
          Effect.forkChild
        );
        yield* TestClock.adjust("11 minutes");
        yield* Fiber.join(flush);

        expect(yield* server.counts).toMatchObject({ head: 0, submits: 0 });
        expect(reportClientException).toHaveBeenCalledTimes(1);
        expect(reportClientException).toHaveBeenCalledWith(
          expect.objectContaining({ _tag: "SyncFolding" }),
          { source: SOURCE }
        );
      })
  );
});
