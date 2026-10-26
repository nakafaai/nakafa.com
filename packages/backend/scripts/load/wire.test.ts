import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  NotInSitting,
  StaleAnswer,
} from "@repo/backend/confect/exams/sittings/errors";
import {
  openWire,
  send,
  type Wire,
  WireFailed,
  watch,
} from "@repo/backend/scripts/load/wire";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { ConvexError } from "convex/values";
import { Deferred, Effect, Exit, Schema, Scope } from "effect";

const mocks = vi.hoisted(() => ({
  clients: [] as {
    address: string;
    closed: boolean;
    options: unknown;
    token: (() => Promise<string>) | undefined;
  }[],
}));
vi.mock("convex/browser", () => ({
  ConvexClient: class {
    readonly record: (typeof mocks.clients)[number];
    constructor(address: string, options: unknown) {
      this.record = { address, closed: false, options, token: undefined };
      mocks.clients.push(this.record);
    }
    setAuth(fetchToken: () => Promise<string>) {
      this.record.token = fetchToken;
    }
    close() {
      this.record.closed = true;
      return Promise.resolve();
    }
  },
}));

const sittings = refs.public.exams.sittings;

/** A wire whose server answers every mutation with `reply`, and keeps each live query's callbacks. */
const fakeWire = (reply: () => Promise<unknown>) => {
  const listeners: {
    args: unknown;
    onError: (error: Error) => void;
    onValue: (value: unknown) => void;
    open: boolean;
  }[] = [];
  const wire: Wire = {
    close: () => Promise.resolve(),
    mutation: () => reply(),
    onUpdate: (_reference, args, onValue, onError) => {
      const listener = { args, onError, onValue, open: true };
      listeners.push(listener);
      return () => {
        listener.open = false;
      };
    },
  };
  return { listeners, wire };
};

const answerArgs = {
  deviceId: "0f8fad5b-d9cb-469f-a165-70867728950e",
  questionId: "q1",
  response: ["option-1"],
  sittingId: "s1",
  slug: Schema.decodeSync(TenantSlug)("sekolah"),
  version: 1,
};

describe("load wire", () => {
  it.effect("sends a mutation through its codec and decodes the reply", () =>
    Effect.gen(function* () {
      const { wire } = fakeWire(() => Promise.resolve(null));
      expect(yield* send(wire, sittings.answer, answerArgs)).toBeNull();
    })
  );

  it.effect("decodes a typed refusal, and names any other failure", () =>
    Effect.gen(function* () {
      const stale = fakeWire(() =>
        Promise.reject(
          new ConvexError(Schema.encodeSync(StaleAnswer)(new StaleAnswer()))
        )
      );
      expect(
        yield* Effect.flip(send(stale.wire, sittings.answer, answerArgs))
      ).toMatchObject({ _tag: "StaleAnswer" });
      const broken = fakeWire(() => Promise.reject(new Error("socket closed")));
      expect(
        yield* Effect.flip(send(broken.wire, sittings.answer, answerArgs))
      ).toEqual(new WireFailed({ message: "socket closed" }));
      const odd = fakeWire(() => Promise.reject("odd"));
      expect(
        yield* Effect.flip(send(odd.wire, sittings.answer, answerArgs))
      ).toEqual(new WireFailed({ message: "The call failed." }));
    })
  );

  it.effect(
    "keeps a live query open for its scope, completes on its first value, and passes on every value",
    () =>
      Effect.gen(function* () {
        const { listeners, wire } = fakeWire(() => Promise.resolve(null));
        const seen: unknown[] = [];
        const scope = yield* Scope.make();
        const first = yield* watch(
          wire,
          sittings.lastAnswer,
          { attemptId: "a1", sittingId: "s1", slug: answerArgs.slug },
          (value) => seen.push(value)
        ).pipe(Scope.provide(scope));
        const [listener] = listeners;
        expect(listener?.args).toEqual({
          attemptId: "a1",
          sittingId: "s1",
          slug: "sekolah",
        });
        listener?.onValue(null);
        listener?.onValue(1200);
        expect(yield* Deferred.await(first)).toBeNull();
        expect(yield* Deferred.isDone(first)).toBe(true);
        expect(seen).toEqual([null, 1200]);
        expect(listener?.open).toBe(true);
        yield* Scope.close(scope, Exit.void);
        expect(listener?.open).toBe(false);
      })
  );

  it.effect("fails the first value with the query's typed error", () =>
    Effect.gen(function* () {
      const { listeners, wire } = fakeWire(() => Promise.resolve(null));
      const first = yield* watch(
        wire,
        sittings.student,
        { sittingId: "s1", slug: answerArgs.slug },
        () => undefined
      );
      listeners[0]?.onError(
        new ConvexError(Schema.encodeSync(NotInSitting)(new NotInSitting()))
      );
      expect(yield* Effect.flip(Deferred.await(first))).toMatchObject({
        _tag: "NotInSitting",
      });
    }).pipe(Effect.scoped)
  );

  it.effect(
    "opens a client at the address, signed in through the token's effect, and closes it with its scope",
    () =>
      Effect.gen(function* () {
        const scope = yield* Scope.make();
        yield* openWire("http://127.0.0.1:3210", Effect.succeed("jwt")).pipe(
          Scope.provide(scope)
        );
        const [client] = mocks.clients;
        expect(client).toMatchObject({
          address: "http://127.0.0.1:3210",
          options: {
            skipConvexDeploymentUrlCheck: true,
            unsavedChangesWarning: false,
          },
        });
        expect(
          yield* Effect.promise(() => client?.token?.() ?? Promise.resolve(""))
        ).toBe("jwt");
        expect(client?.closed).toBe(false);
        yield* Scope.close(scope, Exit.void);
        expect(client?.closed).toBe(true);
      })
  );
});
