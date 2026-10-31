import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  NotInSitting,
  StaleAnswer,
} from "@repo/backend/confect/exams/sittings/errors";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import {
  openWire,
  send,
  type Wire,
  WireFailed,
  watch,
} from "@repo/backend/scripts/load/wire";
import { idOf } from "@repo/backend/test/load";
import { ConvexError } from "convex/values";
import {
  Array as Arr,
  Deferred,
  Effect,
  Exit,
  MutableList,
  Schema,
  Scope,
} from "effect";

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  created: vi.fn(),
  setAuth: vi.fn(),
}));
vi.mock("convex/browser", () => ({
  ConvexClient: class {
    constructor(address: string, options: unknown) {
      mocks.created(address, options);
    }
    setAuth(fetchToken: () => Promise<string>) {
      mocks.setAuth(fetchToken);
    }
    close() {
      mocks.close();
      return Promise.resolve();
    }
  },
}));

const sittings = refs.public.exams.sittings;

/** The refusal of a stale answer, as the server throws it. */
const stale = new ConvexError(
  Schema.encodeSync(StaleAnswer)(new StaleAnswer())
);

/** The refusal of a student who holds no attempt, as the server throws it. */
const notInSitting = new ConvexError(
  Schema.encodeSync(NotInSitting)(new NotInSitting())
);

/** A listener of one live query on the fake wire, open until the client lets it go. */
interface Listener {
  readonly args: unknown;
  readonly onError: (error: Error) => void;
  readonly onValue: (value: unknown) => void;
  open: boolean;
}

/** A wire whose server answers every mutation with `reply`, and keeps each live query's callbacks. */
const fakeWire = (reply: () => Promise<unknown>) => {
  const listeners = MutableList.make<Listener>();
  const wire: Wire = {
    close: () => Promise.resolve(),
    mutation: () => reply(),
    onUpdate: (_reference, args, onValue, onError) => {
      const listener: Listener = { args, onError, onValue, open: true };
      MutableList.append(listeners, listener);
      return () => {
        listener.open = false;
      };
    },
  };
  return { listeners: () => MutableList.toArray(listeners), wire };
};

const slug = Schema.decodeSync(TenantSlug)("sekolah");

const answerArgs = {
  deviceId: "0f8fad5b-d9cb-469f-a165-70867728950e",
  questionId: idOf("examQuestions", "q1"),
  response: ["option-1"],
  sittingId: idOf("examSittings", "s1"),
  slug,
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
      const refused = fakeWire(() => Promise.reject(stale));
      expect(
        yield* Effect.flip(send(refused.wire, sittings.answer, answerArgs))
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
        const seen = MutableList.make<number | null>();
        const scope = yield* Scope.make();
        const first = yield* watch(
          wire,
          sittings.lastAnswer,
          {
            attemptId: idOf("examAttempts", "a1"),
            sittingId: idOf("examSittings", "s1"),
            slug,
          },
          (value) => MutableList.append(seen, value)
        ).pipe(Scope.provide(scope));
        const [listener] = listeners();
        expect(listener?.args).toEqual({
          attemptId: "a1",
          sittingId: "s1",
          slug: "sekolah",
        });
        listener?.onValue(null);
        listener?.onValue(1200);
        expect(yield* Deferred.await(first)).toBeNull();
        expect(MutableList.toArray(seen)).toEqual([null, 1200]);
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
        { sittingId: idOf("examSittings", "s1"), slug },
        () => undefined
      );
      Arr.forEach(listeners(), (listener) => listener.onError(notInSitting));
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
        expect(mocks.created).toHaveBeenCalledExactlyOnceWith(
          "http://127.0.0.1:3210",
          { skipConvexDeploymentUrlCheck: true, unsavedChangesWarning: false }
        );
        const [fetchToken] = mocks.setAuth.mock.calls[0] ?? [];
        expect(yield* Effect.promise(() => fetchToken())).toBe("jwt");
        expect(mocks.close).not.toHaveBeenCalled();
        yield* Scope.close(scope, Exit.void);
        expect(mocks.close).toHaveBeenCalledOnce();
      })
  );
});
