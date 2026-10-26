import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import type { Page } from "@playwright/test";
import { CHAT_LIST_PAGE_SIZE } from "@repo/backend/client/chats/list";
import {
  Array as Arr,
  Clock,
  Effect,
  FileSystem,
  Schedule,
  Schema,
} from "effect";
import { runAcceptanceCommand } from "@/e2e/support/acceptance";
import { trackChanges } from "@/e2e/support/changes";
import {
  declineUsageData,
  type PromptLocale,
  seedAnalyticsConsent,
} from "@/e2e/support/consent";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";

/** The new chat page of a language of the site. */
export const chatPathOf = (locale: PromptLocale) => `/${locale}/chat`;
/** The new chat page of the English site. */
export const CHAT_PATH = chatPathOf("en");
/** A lesson, where Nina's sheet opens beside the page. */
export const LESSON_PATH =
  "/en/subjects/mathematics/function-composition-inverse-function/function-concept";
/** How many chats one page of a list loads. */
export const PAGE = CHAT_LIST_PAGE_SIZE;
/**
 * The part of a chat page that holds the conversation, beside the sidebar. The
 * new chat page and the page of the chat it opens share it, and the page the
 * learner left stays in it, hidden, until React renders that page again.
 * `promptWith` counts only the bubbles a reader can see, so the left page
 * never counts.
 */
export const onThePage = (page: Page) => page.locator("main main");
/** The address of a chat that a page moves to once its first prompt is admitted. */
export const OPENED_CHAT = /\/en\/chat\/[a-z0-9]+$/;
/**
 * The Convex names of the functions the chat pages call. The refs module
 * cannot be imported here, because it pulls in packages that Node does not
 * resolve outside the bundler.
 */
const LIST_QUERY = "chats/queries:getOwnChats";
export const START = "nina/turns:start";
export const RENAME = "chats/mutations:updateChatTitle";
export const DELETE = "chats/mutations:deleteChat";
/** The mutation the composer of a profile's posts calls to write a post. */
const POST_CREATE = "posts/mutations:create";
/** The mutation the share dialog calls to turn sharing on, and the query it reads the token with. */
const SHARE = "chats/mutations:updateChatVisibility";
export const SHARE_TOKEN_QUERY = "chats/queries:getShareToken";
/** What the pages say when a change fails. */
export const FAILED = "We could not complete this action.";

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
  appUser: Schema.Struct({
    _id: Schema.String,
    authId: Schema.String,
    username: Schema.String,
  }),
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
   * answered. Convex stops a query or mutation after one second of its own
   * code (https://docs.convex.dev/production/state/limits), and the local
   * backend has no setting to raise that. A machine busy with other work
   * stretches a call past it now and then, and the backend answers "Function
   * execution timed out (maximum duration: 1s)". Such a call is made again, and
   * only such a call: a function that timed out stored nothing, and every call
   * here gives the same answer when it runs twice.
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
    /** Deletes a chat of the learner, as the menu of the chat does. */
    deleteChat: Effect.fn("NakafaE2E.deleteChat")(function* (chatId: string) {
      yield* call("mutation", DELETE, { chatId });
    }),
    /** Writes a post of the learner, as the composer of their profile does, so a test can fill a list quickly. */
    writePost: Effect.fn("NakafaE2E.writePost")(function* (text: string) {
      yield* call("mutation", POST_CREATE, { text });
    }),
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
    /**
     * Shares a chat of the learner the way the share dialog does: the same
     * mutation turns sharing on, and the same query gives the owner the token
     * the server drew, which the chat's link holds. The chat is readable by
     * that link and by nothing else.
     */
    share: Effect.fn("NakafaE2E.share")(function* (chatId: string) {
      yield* call("mutation", SHARE, { chatId, visibility: "public" });
      return yield* call("query", SHARE_TOKEN_QUERY, { chatId }).pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(Schema.String))
      );
    }),
    /**
     * Starts a chat the way the new chat page does, and returns where it lives.
     * A free learner's answer holds every credit of the day while it runs, and
     * the local backend ends each answer at once for want of a model, so a
     * second chat started at the same moment waits for that hold to end, as a
     * learner's own second message does.
     */
    startChat: Effect.fn("NakafaE2E.startChat")(function* (text: string) {
      const now = yield* Clock.currentTimeMillis;
      return yield* call("mutation", START, {
        input: {
          kind: "message",
          page: { locale: "en", slug: "/chat" },
          prompt: { text },
        },
        requestId: `e2e-${now}-${text}`,
      }).pipe(
        Effect.retry({
          schedule: Schedule.spaced("250 millis"),
          times: 40,
          while: (error) => error.message.includes("INSUFFICIENT_CREDITS"),
        }),
        Effect.flatMap(Schema.decodeUnknownEffect(Receipt))
      );
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
    /** The Better Auth id of the learner's account, which the acceptance command names. */
    authId: appUser.authId,
    /** The id of the learner's account in the app. */
    userId: appUser._id,
    /** The username of the learner, which their profile address names. */
    username: appUser.username,
  };
});

/**
 * Signs a synthetic learner in and opens the new chat page, where it waits
 * until the page is signed in. It returns the tracker of the changes the page
 * sends from then on, and the learner as the backend sees them. The page is
 * the English one unless `locale` names another language of the site.
 */
export const openChatPage = Effect.fn("NakafaE2E.openChatPage")(function* (
  page: Page,
  baseURL: string,
  locale: PromptLocale = "en"
) {
  const changes = yield* trackChanges(page, [LIST_QUERY]);
  yield* seedAnalyticsConsent(page, "denied");
  yield* signInLearner(page.context(), baseURL);
  yield* Effect.promise(() => page.goto(chatPathOf(locale)));

  // The server took the learner's choice, so the page was signed in and its
  // connection to the backend is open.
  yield* declineUsageData(page, changes, locale);
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
