import { expect, type Page } from "@playwright/test";
import { encodeJsonText } from "@repo/utilities/json";
import {
  Array as Arr,
  Effect,
  Match,
  MutableHashMap,
  MutableHashSet,
  MutableList,
  Option,
  Result,
  String as Str,
} from "effect";
import {
  CONVEX_SOCKET,
  changeAnswersIn,
  decodeGiven,
  decodeSent,
  encodeRefusal,
  failQueriesIn,
  type GivenSchema,
  isCall,
  isMutation,
  later,
  momentOf,
  type SentSchema,
} from "@/e2e/support/frames";

/** How long a step waits for the server to answer a change. */
export const ANSWER_MILLISECONDS = 15_000;

/**
 * Follows the page's realtime connection: the changes it sent and the ones the
 * server answered, whether it has signed in, and whether a list has answered.
 * A change is a mutation or an action, such as an upload, because either can
 * write. `lists` names the Convex queries that read a list, such as
 * `nina/memory:list`.
 * The page shows a change before the server has it, and a reload closes the
 * connection and drops a change that is still on its way, so a step that
 * reloads waits for the answer first. A reload also opens a connection that
 * signs in a moment after the page shows, and a change pressed before that is
 * refused.
 *
 * A change is settled once the server answered it and the page was told of the
 * database as it was when the change was stored, which is when the page drops
 * the optimistic result for the stored one. `stored` is the latest moment a
 * change was stored at, and `told` the latest the page was told of.
 *
 * Every frame passes through this route, so a step can also hold the server's
 * answers back: after `hold` the page gets nothing from the server until
 * `release`, and what it shows meanwhile is what it showed on its own. A step
 * can also fail one change: after `failNext` the next change the page sends, a
 * mutation or an action, never reaches the server, and the page is told the
 * server could not take it, with the typed failure the step names, if any.
 * It can fail the answers of a query too: after `failQuery` every answer of
 * that function reaches the page as the failure the server sends when the
 * function throws, until `recoverQuery`. It can change what a query answers,
 * the way a backend that held other data would (`rewrite`). What the tracker
 * knows is what the page was given, never what the server sent.
 *
 * It also keeps the frame of every change the server took, so a step can ask
 * whether the server holds given words (`took`). The count of changes cannot
 * say that: the editor saves after a pause as well as when it closes, and a
 * save that waits for the memory to be added goes out a moment after the
 * server answered the add. It keeps what the server answered to each query
 * too, so a step can ask what the page was told (`answersTo`).
 */
export const trackChanges = Effect.fn("NakafaE2E.trackChanges")(function* (
  page: Page,
  lists: readonly string[]
) {
  const changes = {
    answered: 0,
    failing: false,
    /** The function the next failure is for; empty for any function. */
    failingPath: "",
    /** The query whose answers fail, and what the page is told of why. */
    failingQuery: Option.none<{ data: unknown; path: string }>(),
    /** The typed failure the next failure carries; none for a server that broke. */
    failingRefusal: Option.none<unknown>(),
    held: false,
    listed: false,
    /** The HTTP origin of the backend the page talks to; empty until its connection opened. */
    origin: "",
    /** The query whose answers are changed, and how. */
    rewriting: Option.none<{
      change: (value: unknown) => unknown;
      path: string;
    }>(),
    sent: 0,
    signedIn: false,
    stored: 0n,
    told: 0n,
  };
  const calls = MutableList.make<{
    args: readonly unknown[];
    udfPath: string;
  }>();
  /** The functions whose queries the server has answered on this page. */
  const answeredPaths = MutableHashSet.empty<string>();
  /** The functions the page asked for while its connection had not signed in. */
  const askedSignedOut = MutableHashSet.empty<string>();
  // The frames of the changes on their way, by the id the server answers with.
  const waiting = MutableHashMap.empty<number, string>();
  // The frames of the changes the server took.
  const taken = MutableList.make<string>();
  // What the server answered to each query the page runs, as JSON text.
  const answers = MutableList.make<{ text: string; udfPath: string }>();
  const delayed = MutableList.make<() => void>();
  /** Gives the page a frame now, or after `release` while the answers are held back. */
  const deliver = (give: () => void) => {
    if (changes.held) {
      MutableList.append(delayed, give);
      return;
    }
    give();
  };

  // A reload ends the connection that had signed in, before the next one opens.
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      changes.signedIn = false;
      changes.listed = false;
      MutableHashSet.clear(answeredPaths);
    }
  });
  yield* Effect.promise(() =>
    page.routeWebSocket(CONVEX_SOCKET, (socket) => {
      const server = socket.connectToServer();
      const address = new URL(socket.url());
      address.protocol = address.protocol === "wss:" ? "https:" : "http:";
      changes.origin = address.origin;
      // The function that each query of this connection runs, by its id.
      const queries = MutableHashMap.empty<number, string>();
      /** The ids of the queries of this connection that run `udfPath`. */
      const queriesOf = (udfPath: string) =>
        Arr.filterMap(Arr.fromIterable(queries), ([queryId, path]) =>
          path === udfPath ? Result.succeed(queryId) : Result.failVoid
        );

      /** A mutation and an action are both changes the page asks the server to make. */
      const noticeChange = ({
        args,
        udfPath,
      }: Extract<typeof SentSchema.Type, { type: "Action" | "Mutation" }>) => {
        changes.sent += 1;
        MutableList.append(calls, { args, udfPath });
      };
      const noticeSent = (frame: typeof SentSchema.Type) =>
        Match.value(frame).pipe(
          Match.discriminators("type")({
            Action: noticeChange,
            Authenticate: () => {
              changes.signedIn = true;
            },
            ModifyQuerySet: ({ modifications }) => {
              for (const query of modifications) {
                if (query.udfPath) {
                  MutableHashMap.set(queries, query.queryId, query.udfPath);
                  if (!changes.signedIn) {
                    MutableHashSet.add(askedSignedOut, query.udfPath);
                  }
                }
              }
            },
            Mutation: noticeChange,
          }),
          Match.exhaustive
        );
      const noticeGiven = (frame: typeof GivenSchema.Type) =>
        Match.value(frame).pipe(
          Match.discriminators("type")({
            ActionResponse: () => {
              changes.answered += 1;
            },
            MutationResponse: ({ requestId, success, ts }) => {
              changes.answered += 1;
              if (ts) {
                changes.stored = later(changes.stored, momentOf(ts));
              }
              if (success) {
                MutableList.appendAll(
                  taken,
                  Option.toArray(MutableHashMap.get(waiting, requestId))
                );
              }
              MutableHashMap.remove(waiting, requestId);
            },
            Transition: ({ endVersion, modifications }) => {
              changes.told = later(changes.told, momentOf(endVersion.ts));
              for (const change of modifications) {
                const path = MutableHashMap.get(queries, change.queryId);

                if (change.type === "QueryUpdated" && Option.isSome(path)) {
                  MutableHashSet.add(answeredPaths, path.value);
                  MutableList.append(answers, {
                    text: encodeJsonText(change.value),
                    udfPath: path.value,
                  });
                  changes.listed ||= Arr.contains(lists, path.value);
                }
              }
            },
          }),
          Match.exhaustive
        );

      socket.onMessage((message) => {
        const frame = decodeSent(message.toString());
        const call = Option.filter(frame, isCall);
        const mutation = Option.filter(frame, isMutation);

        if (Option.isSome(frame)) {
          noticeSent(frame.value);
        }
        if (
          changes.failing &&
          Option.isSome(call) &&
          (changes.failingPath === "" ||
            changes.failingPath === call.value.udfPath)
        ) {
          const { requestId, type } = call.value;
          const refusal = changes.failingRefusal;

          changes.failing = false;
          changes.failingRefusal = Option.none();
          // The server never sees the call, and the page is told it failed.
          deliver(() => {
            socket.send(
              encodeRefusal({
                errorData: Option.getOrUndefined(refusal),
                logLines: [],
                requestId,
                result: "Refused by the test",
                success: false,
                type: type === "Action" ? "ActionResponse" : "MutationResponse",
              })
            );
            // A refused action was counted as sent, as a refused mutation was.
            changes.answered += 1;
          });
          return;
        }
        if (Option.isSome(mutation)) {
          MutableHashMap.set(
            waiting,
            mutation.value.requestId,
            message.toString()
          );
        }
        server.send(message);
      });
      server.onMessage((message) => {
        // While a query is armed to fail, its answers reach the page as
        // failures, and the tracker notes what the page was given.
        const refused = Option.flatMap(changes.failingQuery, ({ data, path }) =>
          failQueriesIn(message.toString(), queriesOf(path), data)
        );
        // Otherwise the answers of a query that is armed to change are changed.
        const changed = Option.flatMap(changes.rewriting, ({ change, path }) =>
          changeAnswersIn(message.toString(), queriesOf(path), change)
        );
        const given = Option.getOrElse(
          Option.orElse(refused, () => changed),
          () => message
        );
        const frame = decodeGiven(given.toString());

        deliver(() => {
          socket.send(given);
          if (Option.isSome(frame)) {
            noticeGiven(frame.value);
          }
        });
      });
    })
  );

  return Object.assign(changes, {
    /** Whether the server has answered a query of the function `udfPath` on this page. */
    hasAnswered(udfPath: string) {
      return MutableHashSet.has(answeredPaths, udfPath);
    },
    /**
     * Whether the page asked for a query of the function `udfPath` before its
     * connection signed in, on any load. A query that needs the session and is
     * asked that early is answered as signed out first.
     */
    askedSignedOut(udfPath: string) {
      return MutableHashSet.has(askedSignedOut, udfPath);
    },
    /** Every answer to a query of the function `udfPath` on this page, as JSON text, in order. */
    answersTo(udfPath: string) {
      return Arr.map(
        Arr.filter(
          MutableList.toArray(answers),
          (answer) => answer.udfPath === udfPath
        ),
        (answer) => answer.text
      );
    },
    /** The arguments of every change the page sent to the function `udfPath`, in order. */
    argumentsOf(udfPath: string) {
      return Arr.map(
        Arr.filter(
          MutableList.toArray(calls),
          (call) => call.udfPath === udfPath
        ),
        (call) => call.args
      );
    },
    /**
     * Fails the next change the page sends, a mutation or an action, or the
     * next one to the function `udfPath`: the server never gets it, and the
     * page is told the server could not take it. With `refusal`, the page is
     * told the function threw that typed failure on purpose, which it decodes
     * as the function's own error, and not that the server broke.
     */
    failNext(udfPath = "", refusal?: unknown) {
      changes.failing = true;
      changes.failingPath = udfPath;
      changes.failingRefusal = Option.fromNullishOr(refusal);
    },
    /**
     * Fails every answer of a query of the function `udfPath` until
     * `recoverQuery`: the page is told the function threw `data`, which it
     * decodes as the typed failure of that function. A server that fails keeps
     * failing, so a later answer of the same query fails too.
     */
    failQuery(udfPath: string, data: unknown) {
      changes.failingQuery = Option.some({ data, path: udfPath });
    },
    /** Gives the page the server's own answers to the queries again. */
    recoverQuery() {
      changes.failingQuery = Option.none();
    },
    /**
     * Changes every answer of a query of the function `udfPath` from now on:
     * `change` gets the value the server answered and returns the one the
     * page is given. A page that was answered before only shows it once the
     * query answers again, as it does after a reload.
     */
    rewrite(udfPath: string, change: (value: unknown) => unknown) {
      changes.rewriting = Option.some({ change, path: udfPath });
    },
    /** Keeps what the server answers from the page until `release`. */
    hold() {
      changes.held = true;
    },
    /**
     * Whether the server took a change that carried `text`. The words of a
     * test are letters, digits and spaces, which a frame holds as they are.
     */
    took(text: string) {
      return Arr.some(MutableList.toArray(taken), Str.includes(text));
    },
    /** Gives the page everything the server answered meanwhile, in order. */
    release() {
      changes.held = false;
      for (
        let send = MutableList.take(delayed);
        send !== MutableList.Empty;
        send = MutableList.take(delayed)
      ) {
        send();
      }
    },
  });
});

export type Changes = Effect.Success<ReturnType<typeof trackChanges>>;

/**
 * Waits until the page is signed in and its list has answered. A change made
 * before that shows once the list answers, not before, because the page has no
 * list of its own to change until then.
 */
export const live = (changes: Changes) =>
  expect
    .poll(() => changes.signedIn && changes.listed, {
      timeout: ANSWER_MILLISECONDS,
    })
    .toBe(true);

/**
 * Waits until the page sent a change after `sentBefore`, and every change the
 * page sent is settled: the server answered it, and the page was told of the
 * database as it was once the change was stored.
 */
export const saved = (changes: Changes, sentBefore: number) =>
  expect
    .poll(
      () =>
        changes.sent > sentBefore &&
        changes.answered === changes.sent &&
        changes.told >= changes.stored,
      { timeout: ANSWER_MILLISECONDS }
    )
    .toBe(true);

/** Repeats a reload until the server shows what the learner changed. */
export const reloadUntil = (page: Page, check: () => Promise<void>) =>
  expect(async () => {
    await page.reload();
    await check();
  }).toPass({ timeout: 20_000 });
