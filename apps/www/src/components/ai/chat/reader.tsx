import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { Effect, Fiber, Option, Result } from "effect";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import {
  type ChatContextValue,
  ChatValueProvider,
} from "@/components/ai/chat/context";
import { ChatFeedContext } from "@/components/ai/chat/feed";
import { ChatHeader } from "@/components/ai/chat/header";
import {
  ReaderReadError,
  type ReaderView,
  readerView,
  withOlderPage,
} from "@/components/ai/chat/reading";
import { createChatStore } from "@/components/ai/chat/store";
import { turnOf, turnsByOrder } from "@/components/ai/chat/turns";
import { AiChat } from "@/components/ai/chat/view";
import { useLiveSession } from "@/components/providers/live";
import { getPostAuthSignInTarget } from "@/lib/auth/admission";
import type { ReaderRead } from "@/lib/chat/reader";
import { readReaderFn, readReaderOlderFn } from "@/lib/chat/reader.functions";
import { useCurrentLocale } from "@/lib/routing/link";

// The failure card holds the sign-in chain, which only a reader who cannot open
// the chat needs, so it loads when the card is needed.
const ChatFailure = lazy(() =>
  import("@/components/ai/chat/failure").then((module) => ({
    default: module.ChatFailure,
  }))
);

const ignore = () => undefined;
/** A reader cannot send, so the one send that reaches the chat is refused. */
const refuse = (): false => false;

/**
 * The page of a shared chat for a reader, who holds no client. The token of the
 * link lives in the fragment, which the server never sees, so the header renders
 * on the server and the chat is read here, with the token in the body of the
 * request. While the learner's session still loads, only the header shows.
 */
export function ReaderChatPage({
  chatId,
  shareToken,
}: {
  chatId: Id<"chats">;
  shareToken: string | undefined;
}) {
  const [attempt, setAttempt] = useState(0);
  const isSessionPending = useLiveSession((state) => state.isPending);
  if (isSessionPending) {
    return <ChatHeader />;
  }
  if (shareToken === undefined) {
    return <ReaderUnavailable />;
  }
  // A new attempt remounts the read, which runs it again.
  return (
    <ReaderLoad
      chatId={chatId}
      key={`${chatId}\n${shareToken}\n${attempt}`}
      onRetry={() => setAttempt((count) => count + 1)}
      shareToken={shareToken}
    />
  );
}

/** Reads the chat for this mount, and shows what the read answers. */
function ReaderLoad({
  chatId,
  onRetry,
  shareToken,
}: {
  chatId: Id<"chats">;
  onRetry: () => void;
  shareToken: string;
}) {
  const [answer, setAnswer] = useState<
    Option.Option<Result.Result<ReaderRead, ReaderReadError>>
  >(() => Option.none());

  useEffect(() => {
    const fiber = Effect.runFork(
      Effect.tryPromise({
        try: () => readReaderFn({ data: { chatId, shareToken } }),
        catch: (cause) => new ReaderReadError({ cause }),
      }).pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            Effect.sync(() => {
              setAnswer(Option.some(Result.fail(error)));
            }),
          onSuccess: (read) =>
            Effect.sync(() => {
              setAnswer(Option.some(Result.succeed(read)));
            }),
        })
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [chatId, shareToken]);

  if (Option.isNone(answer)) {
    return <ChatHeader />;
  }
  if (Result.isFailure(answer.value)) {
    return <ReaderFailure onRetry={onRetry} />;
  }
  const read = answer.value.success;
  if (read.status === "unavailable") {
    return <ReaderUnavailable />;
  }
  const initial = readerView(read);
  if (Result.isFailure(initial)) {
    return <ReaderFailure onRetry={onRetry} />;
  }
  return (
    <ReaderTranscript
      chatId={chatId}
      initial={initial.success}
      shareToken={shareToken}
    />
  );
}

/**
 * The transcript of a readable chat. It keeps every page it has loaded, and the
 * message components read the same contexts a learner's chat provides, with
 * every write turned off. One older page loads at a time, so a scroll during a
 * load does not ask for the same page twice.
 */
function ReaderTranscript({
  chatId,
  initial,
  shareToken,
}: {
  chatId: Id<"chats">;
  initial: ReaderView;
  shareToken: string;
}) {
  const [view, setView] = useState<ReaderView>(initial);
  const [store] = useState(createChatStore);
  const loadingOlder = useRef(false);

  function loadOlder() {
    const { messagesCursor, turnsCursor } = view;
    if (messagesCursor === undefined || loadingOlder.current) {
      return;
    }
    loadingOlder.current = true;
    Effect.runFork(
      Effect.tryPromise({
        try: () =>
          readReaderOlderFn({
            data: {
              chatId,
              messagesCursor,
              shareToken,
              threadId: view.chat.threadId,
              ...(turnsCursor === undefined ? {} : { turnsCursor }),
            },
          }),
        catch: (cause) => new ReaderReadError({ cause }),
      }).pipe(
        Effect.flatMap((older) =>
          Effect.fromResult(withOlderPage(view, older))
        ),
        Effect.matchEffect({
          onFailure: () =>
            Effect.logWarning("An older page of a shared chat did not load."),
          onSuccess: (next) =>
            Effect.sync(() => {
              setView(next);
            }),
        }),
        Effect.ensuring(
          Effect.sync(() => {
            loadingOlder.current = false;
          })
        )
      )
    );
  }

  const ended = turnsByOrder(view.endedTurns);
  const chat: ChatContextValue = {
    busy: false,
    cancel: ignore,
    canWrite: false,
    chat: view.chat,
    chatId,
    draft: null,
    isLoading: false,
    isPending: false,
    isViewerPending: false,
    owner: false,
    retry: ignore,
    send: refuse,
    shareToken,
    turn: view.turn,
    turnAt: (order) => turnOf(view.turn, ended, order),
  };

  return (
    <ChatValueProvider store={store} value={chat}>
      <ChatFeedContext
        value={{
          canLoadMore: view.messagesCursor !== undefined,
          loadMore: loadOlder,
          messages: view.messages,
        }}
      >
        <AiChat footer={<ReaderAction />} />
      </ChatFeedContext>
    </ChatValueProvider>
  );
}

/**
 * The one action of a reader's page. It signs in and then opens a new chat,
 * since a reader's chat cannot be continued as the reader's own.
 */
function ReaderAction() {
  const t = useTranslations("Ai");
  const locale = useCurrentLocale();
  const navigate = useNavigate();
  return (
    <div
      className="mx-auto flex w-full max-w-3xl justify-center px-4 pb-4"
      data-slot="reader-action"
    >
      <Button
        onClick={() =>
          navigate(getPostAuthSignInTarget(`/${locale}/chat`, locale))
        }
        size="lg"
      >
        {t("new-chat")}
      </Button>
    </div>
  );
}

/** The card of a chat the token does not open, with the sign-in a reader can take. */
function ReaderUnavailable() {
  return (
    <Suspense fallback={null}>
      <ChatFailure kind="access" />
    </Suspense>
  );
}

/** The card of a read that failed for a reason other than access, with a retry. */
function ReaderFailure({ onRetry }: { onRetry: () => void }) {
  return (
    <Suspense fallback={null}>
      <ChatFailure kind="retry" onRetry={onRetry} />
    </Suspense>
  );
}
