import { expect, type Page } from "@playwright/test";
import {
  Array as Arr,
  Effect,
  Match,
  MutableHashMap,
  MutableHashSet,
  MutableList,
  Option,
  Schema,
  String as Str,
} from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { activate } from "@/e2e/support/input";
import { signInLearner } from "@/e2e/support/learner";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The Memory page of the English site. */
export const MEMORY_PATH = "/en/user/settings/memory";
const MEMORY_TITLE = /Memory/;
/** The realtime connection of the page to the backend. */
const CONVEX_SOCKET = /\/api\/[^/]+\/sync/;
/**
 * The Convex name of `nina.memory.list`, the query that reads a page of the
 * list: the page subscribes to one for each page it loads. The refs module
 * cannot be imported here, because it pulls in packages that Node does not
 * resolve outside the bundler.
 */
const LIST_QUERY = "nina/memory:list";

/** What the Memory page says when the learner has no memory. */
export const EMPTY = "No memories yet";
/** What the Memory page says when every memory is loaded and none matches the search. */
export const NO_RESULT = "No memory found";
/** How long a step waits for the server to answer a change. */
export const ANSWER_MILLISECONDS = 15_000;

/** One memory on the page, found by its title or its words. */
export const memoryRow = (page: Page, text: string) =>
  page.locator("main").getByRole("listitem").filter({ hasText: text });

/** The text of a memory in its editor. The editor's code loads when the learner opens it. */
export const editorOf = (page: Page) =>
  page.getByRole("textbox", { name: "Memory text" });

/**
 * Waits for an editor that just opened to hold `text` and the caret. The
 * editor takes the focus a moment after it appears, so a press before that
 * would land in the text instead of where it aimed.
 */
export const opened = async (page: Page, text: string) => {
  const editor = editorOf(page);
  await expect(editor).toHaveText(text, {
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(editor).toBeFocused();
};

/** A change the page sends, which the server answers with the same `requestId`. */
const MutationSchema = Schema.Struct({
  requestId: Schema.Finite,
  type: Schema.Literal("Mutation"),
});

/** The answer of a server that could not take a change, as the protocol words it. */
const RefusalSchema = Schema.Struct({
  logLines: Schema.Array(Schema.String),
  requestId: Schema.Finite,
  result: Schema.String,
  success: Schema.Literal(false),
  type: Schema.Literal("MutationResponse"),
});

/** The frames the page sends that a step waits on. Any other frame decodes to none. */
const SentSchema = Schema.Union([
  Schema.Struct({
    tokenType: Schema.Literal("User"),
    type: Schema.Literal("Authenticate"),
  }),
  MutationSchema,
  Schema.Struct({
    modifications: Schema.Array(
      Schema.Struct({
        queryId: Schema.Finite,
        type: Schema.String,
        udfPath: Schema.optionalKey(Schema.String),
      })
    ),
    type: Schema.Literal("ModifyQuerySet"),
  }),
]);

/**
 * The frames the server sends that a step waits on. A `ts` is a moment of the
 * database, which the protocol writes as eight bytes in Base64.
 */
const GivenSchema = Schema.Union([
  Schema.Struct({
    requestId: Schema.Finite,
    success: Schema.Boolean,
    ts: Schema.optionalKey(Schema.Uint8ArrayFromBase64),
    type: Schema.Literal("MutationResponse"),
  }),
  Schema.Struct({
    endVersion: Schema.Struct({ ts: Schema.Uint8ArrayFromBase64 }),
    modifications: Schema.Array(
      Schema.Struct({ queryId: Schema.Finite, type: Schema.String })
    ),
    type: Schema.Literal("Transition"),
  }),
]);

const decodeSent = Schema.decodeOption(Schema.fromJsonString(SentSchema));
const decodeGiven = Schema.decodeOption(Schema.fromJsonString(GivenSchema));
const encodeRefusal = Schema.encodeSync(Schema.fromJsonString(RefusalSchema));
const isMutation = Schema.is(MutationSchema);

/** The moment of the database that a `ts` names: eight bytes, the least significant first. */
const momentOf = (bytes: Uint8Array) =>
  Arr.reduceRight(
    Arr.fromIterable(bytes),
    0n,
    (moment, byte) => moment * 256n + BigInt(byte)
  );

/** The later of two moments. */
const later = (one: bigint, other: bigint) => (one > other ? one : other);

/**
 * Follows the page's realtime connection: the changes it sent and the ones the
 * server answered, whether it has signed in, and whether the list has answered.
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
 * can also fail one change: after `failNext` the next change the page sends
 * never reaches the server, and the page is told the server could not take it.
 * What the tracker knows is what the page was given, never what the server sent.
 *
 * It also keeps the frame of every change the server took, so a step can ask
 * whether the server holds given words (`took`). The count of changes cannot
 * say that: the editor saves after a pause as well as when it closes, and a
 * save that waits for the memory to be added goes out a moment after the
 * server answered the add.
 */
const trackChanges = Effect.fn("NakafaE2E.trackChanges")(function* (
  page: Page
) {
  const changes = {
    answered: 0,
    failing: false,
    held: false,
    listed: false,
    sent: 0,
    signedIn: false,
    stored: 0n,
    told: 0n,
  };
  const delayed = MutableList.make<() => void>();
  // The frames of the changes on their way, by the id the server answers with.
  const waiting = MutableHashMap.empty<number, string>();
  // The frames of the changes the server took.
  const taken = MutableList.make<string>();
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
    }
  });
  yield* Effect.promise(() =>
    page.routeWebSocket(CONVEX_SOCKET, (socket) => {
      const server = socket.connectToServer();
      // The queries of this connection that read the list.
      const lists = MutableHashSet.empty<number>();

      const noticeSent = (frame: typeof SentSchema.Type) =>
        Match.value(frame).pipe(
          Match.discriminators("type")({
            Authenticate: () => {
              changes.signedIn = true;
            },
            ModifyQuerySet: ({ modifications }) => {
              for (const query of modifications) {
                if (query.udfPath === LIST_QUERY) {
                  MutableHashSet.add(lists, query.queryId);
                }
              }
            },
            Mutation: () => {
              changes.sent += 1;
            },
          }),
          Match.exhaustive
        );
      const noticeGiven = (frame: typeof GivenSchema.Type) =>
        Match.value(frame).pipe(
          Match.discriminators("type")({
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
              changes.listed ||= Arr.some(
                modifications,
                (change) =>
                  change.type === "QueryUpdated" &&
                  MutableHashSet.has(lists, change.queryId)
              );
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
        if (changes.failing && Option.isSome(mutation)) {
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
    /**
     * Fails the next change the page sends: the server never gets it, and the
     * page is told the server could not take it.
     */
    failNext() {
      changes.failing = true;
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
 * Waits until the page is signed in and the list has answered. A change made
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

/**
 * Signs a synthetic learner in and opens the Memory page. It returns the
 * tracker of the changes the page sends from then on.
 */
export const openMemoryPage = Effect.fn("NakafaE2E.openMemoryPage")(function* (
  page: Page,
  baseURL: string
) {
  const changes = yield* trackChanges(page);
  yield* seedAnalyticsConsent(page, "denied");
  yield* signInLearner(page.context(), baseURL);
  yield* Effect.promise(() => page.goto(MEMORY_PATH));
  yield* Effect.promise(() => expect(page).toHaveTitle(MEMORY_TITLE));

  // A signed-in learner decides analytics once for the account.
  const decline = page.getByRole("button", { exact: true, name: "Decline" });
  yield* activate(decline, false);
  yield* Effect.promise(() =>
    expect(decline).toBeHidden({ timeout: readinessTimeoutMilliseconds })
  );
  return changes;
});
