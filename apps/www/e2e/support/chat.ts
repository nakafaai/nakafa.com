import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { expect, type Page } from "@playwright/test";
import { Array as Arr, Clock, Effect, FileSystem, Schema } from "effect";
import { CHAT_LIST_PAGE_SIZE } from "@/components/ai/chat/history";
import { runAcceptanceCommand } from "@/e2e/support/acceptance";
import { trackChanges } from "@/e2e/support/changes";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { activate } from "@/e2e/support/input";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The new chat page of the English site. */
export const CHAT_PATH = "/en/chat";
/** A lesson, where Nina's sheet opens beside the page. */
export const LESSON_PATH =
  "/en/subjects/mathematics/function-composition-inverse-function/function-concept";
/** How many chats one page of a list loads. */
export const PAGE = CHAT_LIST_PAGE_SIZE;
/**
 * The Convex names of the functions the chat pages call. The refs module
 * cannot be imported here, because it pulls in packages that Node does not
 * resolve outside the bundler.
 */
const LIST_QUERY = "chats/queries:getOwnChats";
export const START = "nina/turns:start";
export const RENAME = "chats/mutations:updateChatTitle";
export const DELETE = "chats/mutations:deleteChat";
const VISIBILITY = "chats/mutations:updateChatVisibility";
/** What the pages say when a change fails. */
export const FAILED = "We could not complete this action. Please try again.";

/** A call to the backend that did not succeed. */
class ConvexCallError extends Schema.TaggedError<ConvexCallError>()(
  "ConvexCallError",
  { message: Schema.String, path: Schema.String }
) {}

/** How the backend's HTTP API answers one call. */
const Answer = Schema.Union([
  Schema.Struct({ status: Schema.Literal("success"), value: Schema.Unknown }),
  Schema.Struct({
    errorMessage: Schema.String,
    status: Schema.Literal("error"),
  }),
]);
const Token = Schema.Struct({ token: Schema.String });
const CurrentUser = Schema.Struct({
  appUser: Schema.Struct({ _id: Schema.String }),
});
const Receipt = Schema.Struct({
  chatId: Schema.String,
  threadId: Schema.String,
});
const NewestChats = Schema.Struct({
  page: Schema.Array(Schema.Struct({ _id: Schema.String })),
});
/** One chat of a learner, as `convex import` takes it. */
const ChatRow = Schema.fromJsonString(
  Schema.Struct({
    threadId: Schema.String,
    type: Schema.Literal("study"),
    updatedAt: Schema.Finite,
    userId: Schema.String,
    visibility: Schema.Literal("private"),
  })
);
const encodeRow = Schema.encodeSync(ChatRow);

/**
 * The learner of one page, acting through the backend's HTTP API with the
 * session the page holds. No app function creates a chat but a turn of Nina,
 * which the local backend cannot answer and a learner may start only a few of
 * a minute, so a test starts a few chats this way and imports the rest.
 */
const learnerOf = Effect.fn("NakafaE2E.learnerOf")(function* (
  page: Page,
  baseURL: string,
  origin: string
) {
  const request = page.context().request;
  const { token } = yield* Effect.promise(async () =>
    (await request.get(`${baseURL}/api/auth/convex/token`)).json()
  ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Token)));

  /**
   * Calls one function of the backend as the learner and returns the value it
   * answered. The local backend stops a function after one second, which a busy
   * machine can exceed now and then, so a call that timed out is made again:
   * every call here gives the same answer when it runs twice.
   */
  const call = (kind: "mutation" | "query", path: string, args: object) =>
    Effect.promise(async () =>
      (
        await request.post(`${origin}/api/${kind}`, {
          data: { args, format: "json", path },
          headers: { Authorization: `Bearer ${token}` },
        })
      ).json()
    ).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(Answer)),
      Effect.flatMap((answer) =>
        answer.status === "error"
          ? Effect.fail(
              new ConvexCallError({ message: answer.errorMessage, path })
            )
          : Effect.succeed(answer.value)
      ),
      Effect.retry({
        times: 2,
        while: (error) =>
          error._tag === "ConvexCallError" &&
          error.message.includes("timed out"),
      })
    );

  const { appUser } = yield* call(
    "query",
    "auth/queries:getCurrentUser",
    {}
  ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(CurrentUser)));

  return {
    /**
     * Adds `count` chats to the list, after the chats it has. They share the
     * thread of a chat that was started, so each can be opened and deleted,
     * and they have no title until the test gives them one.
     */
    importChats: Effect.fn("NakafaE2E.importChats")(
      function* (threadId: string, count: number) {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped({
          prefix: "nakafa-chats-",
        });
        const file = `${directory}/chats.jsonl`;
        const now = yield* Clock.currentTimeMillis;
        const rows = Arr.makeBy(count, (index) =>
          encodeRow({
            threadId,
            type: "study",
            updatedAt: now - count + index,
            userId: appUser._id,
            visibility: "private",
          })
        );
        yield* fs.writeFileString(file, `${Arr.join(rows, "\n")}\n`);
        yield* runAcceptanceCommand("import", "chats", file);
      },
      Effect.scoped,
      Effect.provide(nodeServicesLayer)
    ),
    /** Makes a chat of the learner readable by anyone who has its link. */
    share: Effect.fn("NakafaE2E.share")(function* (chatId: string) {
      yield* call("mutation", VISIBILITY, { chatId, visibility: "public" });
    }),
    /** Starts a chat the way the new chat page does, and returns where it lives. */
    startChat: Effect.fn("NakafaE2E.startChat")(function* (text: string) {
      const now = yield* Clock.currentTimeMillis;
      return yield* call("mutation", START, {
        input: {
          kind: "message",
          page: { locale: "en", slug: "/chat" },
          prompt: { text },
        },
        requestId: `e2e-${now}-${text}`,
      }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Receipt)));
    }),
    /** Gives the newest chats of the list these titles, the newest first. */
    titleNewest: Effect.fn("NakafaE2E.titleNewest")(function* (
      titles: readonly string[]
    ) {
      const newest = yield* call("query", LIST_QUERY, {
        paginationOpts: { cursor: null, numItems: titles.length },
        type: "study",
      }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(NewestChats)));
      yield* Effect.forEach(titles, (title, index) =>
        Effect.fromNullishOr(newest.page[index]).pipe(
          Effect.flatMap((chat) =>
            call("mutation", RENAME, { chatId: chat._id, title })
          )
        )
      );
    }),
    /** The id of the learner's account in the app. */
    userId: appUser._id,
  };
});

/**
 * Signs a synthetic learner in and opens the new chat page, where it waits
 * until the page is signed in. It returns the tracker of the changes the page
 * sends from then on, and the learner as the backend sees them.
 */
export const openChatPage = Effect.fn("NakafaE2E.openChatPage")(function* (
  page: Page,
  baseURL: string
) {
  const changes = yield* trackChanges(page, [LIST_QUERY]);
  yield* seedAnalyticsConsent(page, "denied");
  yield* signInLearner(page.context(), baseURL);
  yield* Effect.promise(() => page.goto(CHAT_PATH));

  // A signed-in learner decides analytics once for the account.
  const decline = page.getByRole("button", { exact: true, name: "Decline" });
  yield* Effect.promise(() =>
    expect(decline).toBeVisible({ timeout: readinessTimeoutMilliseconds })
  );
  yield* activate(decline, false);
  yield* Effect.promise(async () => {
    await expect(decline).toBeHidden({ timeout: readinessTimeoutMilliseconds });
    await expect
      .poll(() => changes.signedIn && changes.origin !== "", {
        timeout: readinessTimeoutMilliseconds,
      })
      .toBe(true);
  });
  const learner = yield* learnerOf(page, baseURL, changes.origin);
  return { changes, learner };
});

/**
 * Runs the program of one browser test against the app. The test fails when
 * the page raises an error that nothing caught, besides what the program asserts.
 */
export const runOnPage = <E>(
  page: Page,
  baseURL: string | undefined,
  program: (origin: string) => Effect.Effect<void, E>
) =>
  Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.fromNullishOr(baseURL).pipe(Effect.flatMap(program))
    )
  );
