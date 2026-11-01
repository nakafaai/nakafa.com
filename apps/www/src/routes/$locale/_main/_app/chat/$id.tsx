import { DEFAULT_TITLE } from "@repo/backend/client/nina/presentation";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { createFileRoute } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { useSyncExternalStore } from "react";
import { ChatHeader } from "@/components/ai/chat/header";
import { readShareToken } from "@/components/ai/chat/link";
import { ReaderChatPage } from "@/components/ai/chat/reader";
import { AiChatPage } from "@/components/ai/chat/screen";
import { ConvexIsland } from "@/components/providers/island";
import { chatScreenFn } from "@/lib/account/home.functions";
import type { ChatInput } from "@/lib/account/input";

/**
 * A saved chat on the server, where its title names the document. A move between
 * pages in the browser reads the chat live, so it waits on no Worker, and the id
 * decodes where the address is.
 */
const readChatScreen = createIsomorphicFn()
  .server((data: typeof ChatInput.Type) => chatScreenFn({ data }))
  .client(({ id }: typeof ChatInput.Type) => ({
    chatId: Schema.decodeUnknownSync(IdSchema("chats"))(id),
    title: undefined,
  }));

export const Route = createFileRoute("/$locale/_main/_app/chat/$id")({
  loader: ({ params }) =>
    readChatScreen({ id: params.id, locale: params.locale }),
  head: ({ loaderData }) => ({
    // A chat Nina has not named yet keeps the title of the new chat page.
    meta:
      loaderData?.title && loaderData.title !== DEFAULT_TITLE
        ? [{ title: loaderData.title }]
        : [],
  }),
  component: ChatRoute,
});

/** Calls `onChange` when the fragment of the page changes. */
function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/** The share token the link carries in its fragment, empty when it carries none. */
function readFragment() {
  return readShareToken(window.location.hash) ?? "";
}

/** A server never sees a fragment, so it renders before the token is read. */
function readServerFragment() {
  return null;
}

function ChatRoute() {
  const { chatId } = Route.useLoaderData();
  const fragment = useSyncExternalStore(
    subscribe,
    readFragment,
    readServerFragment
  );
  if (fragment === null) {
    return <ChatHeader />;
  }
  const shareToken = fragment === "" ? undefined : fragment;
  return (
    <ConvexIsland
      fallback={<ReaderChatPage chatId={chatId} shareToken={shareToken} />}
    >
      <AiChatPage chatId={chatId} key={chatId} shareToken={shareToken} />
    </ConvexIsland>
  );
}
