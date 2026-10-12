import { expect, type Page } from "@playwright/test";
import {
  Array as Arr,
  Effect,
  Match,
  MutableHashMap,
  MutableHashSet,
  MutableList,
  Option,
  String as Str,
} from "effect";
import {
  decodeGiven,
  decodeSent,
  encodeRefusal,
  type GivenSchema,
  isMutation,
  later,
  momentOf,
  type SentSchema,
} from "@/e2e/support/frames";

/** The realtime connection of the page to the backend. */
const CONVEX_SOCKET = /\/api\/[^/]+\/sync/;

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
 * can also fail one mutation: after `failNext` the next mutation the page sends
 * never reaches the server, and the page is told the server could not take it.
 * What the tracker knows is what the page was given, never what the server sent.
 *
 * It also keeps the frame of every change the server took, so a step can ask
 * whether the server holds given words (`took`). The count of changes cannot
 * say that: the editor saves after a pause as well as when it closes, and a
 * save that waits for the memory to be added goes out a moment after the
 * server answered the add.
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
    held: false,
    listed: false,
    /** The HTTP origin of the backend the page talks to; empty until its connection opened. */
    origin: "",
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
  // The frames of the changes on their way, by the id the server answers with.
  const waiting = MutableHashMap.empty<number, string>();
  // The frames of the changes the server took.
  const taken = MutableList.make<string>();
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
                  changes.listed ||= Arr.contains(lists, path.value);
                }
              }
            },
          }),
          Match.exhaustive
        );

      socket.onMessage((message) => {
        const frame = decodeSent(message.toString());
        const mutation = Option.filter(frame, isMutation);

        if (Option.isSome(frame)) {
          noticeSent(frame.value);
        }
        if (
          changes.failing &&
          Option.isSome(mutation) &&
          (changes.failingPath === "" ||
            changes.failingPath === mutation.value.udfPath)
        ) {
          changes.failing = false;
          // The server never sees the change, and the page is told it failed.
          deliver(() => {
            socket.send(
              encodeRefusal({
                logLines: [],
                requestId: mutation.value.requestId,
                result: "Refused by the test",
                success: false,
                type: "MutationResponse",
              })
            );
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
        const frame = decodeGiven(message.toString());

        deliver(() => {
          socket.send(message);
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
     * Fails the next mutation the page sends, or the next one to the function
     * `udfPath`: the server never gets it, and the page is told the server
     * could not take it.
     */
    failNext(udfPath = "") {
      changes.failing = true;
      changes.failingPath = udfPath;
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
