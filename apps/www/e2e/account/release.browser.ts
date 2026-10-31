import { expect, test, type WebSocket } from "@playwright/test";
import { Array as Arr, Effect, Predicate, pipe } from "effect";
import { signInLearner } from "@/e2e/support/learner";
import {
  withObservedEvents,
  withObservedPageErrors,
} from "@/e2e/support/observe";
import { appRoutes } from "@/e2e/support/route";
import { revealTimeoutMilliseconds } from "@/e2e/support/timeout";

const PRICING_PATH = "/en/pricing";
/** What the observer records when the page opens a socket. */
const SOCKET_OPENED = "socket opened";
/** The query behind the pricing page's billing button, by the name the client subscribes to. */
const PLAN_QUERY = "billing/queries:overview";
/** How Convex's sync protocol names the client's token and the server's answer. */
const TOKEN_SENT = '"tokenType":"User"';
const SERVER_ANSWER = '"type":"Transition"';
/** How Convex's sync protocol names a query the server refused. */
const QUERY_REFUSED = '"type":"QueryFailed"';

const isSocket = (frame: string) => frame === SOCKET_OPENED;
const isPlan = (frame: string) => frame.includes(PLAN_QUERY);
const isToken = (frame: string) => frame.includes(TOKEN_SENT);
const isAnswer = (frame: string) => frame.includes(SERVER_ANSWER);
const isRefused = (frame: string) => frame.includes(QUERY_REFUSED);

/** The frames after the first one that `isMark` accepts. */
const framesAfter = (
  frames: readonly string[],
  isMark: (frame: string) => boolean
) => pipe(frames, Arr.dropWhile(Predicate.not(isMark)), Arr.drop(1));

/** Whether the server has answered the page's plan query. */
const hasPlan = (frames: readonly string[]) =>
  Arr.some(framesAfter(frames, isPlan), isAnswer);

/** Whether the server has answered the second route group's token. */
const hasSecondToken = (frames: readonly string[]) =>
  Arr.some(framesAfter(framesAfter(frames, isToken), isToken), isAnswer);

/**
 * The marketing pages and the student shell each mount their own providers
 * around the page's one Convex client, so a learner who moves between them ends
 * one group's hold on the credentials and starts the next. The socket's frames
 * are the proof: a query the server refuses never reaches the page, because the
 * leaving group has released it by the time the answer arrives.
 */
test("a learner changes route groups without a refused query", async ({
  baseURL,
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        const origin = yield* Effect.fromNullishOr(baseURL);
        yield* signInLearner(page.context(), origin);
        const run = Effect.runPromiseWith(yield* Effect.context<never>());

        yield* withObservedEvents(
          (record) => {
            const recordFrame = ({ payload }: { payload: string | Buffer }) => {
              if (typeof payload === "string") {
                record(payload);
              }
            };
            const listen = (socket: WebSocket) => {
              record(SOCKET_OPENED);
              socket.on("framesent", recordFrame);
              socket.on("framereceived", recordFrame);
            };
            page.on("websocket", listen);
            return () => page.off("websocket", listen);
          },
          (frames) =>
            Effect.gen(function* () {
              yield* Effect.promise(() => page.goto(PRICING_PATH));
              yield* Effect.promise(() =>
                expect
                  .poll(() => run(Effect.map(frames, hasPlan)), {
                    timeout: revealTimeoutMilliseconds,
                  })
                  .toBe(true)
              );

              yield* Effect.promise(() =>
                page.locator(`a[href="${appRoutes.quran}"]`).first().click()
              );
              yield* Effect.promise(() =>
                page.waitForURL(`**${appRoutes.quran}`)
              );
              yield* Effect.promise(() =>
                expect
                  .poll(() => run(Effect.map(frames, hasSecondToken)), {
                    timeout: revealTimeoutMilliseconds,
                  })
                  .toBe(true)
              );

              const seen = yield* frames;
              expect(Arr.filter(seen, isRefused)).toEqual([]);
              // One socket across the move, so this was a client navigation.
              expect(Arr.filter(seen, isSocket)).toHaveLength(1);
            })
        );
      })
    )
  );
});
