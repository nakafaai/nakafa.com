import { createFileRoute } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { ChatHeader } from "@/components/ai/chat/header";
import { readShareToken } from "@/components/ai/chat/link";
import { ReaderChatPage } from "@/components/ai/chat/reader";
import { AiChatPage } from "@/components/ai/chat/screen";
import { ConvexIsland } from "@/components/providers/island";
import { chatScreenFn } from "@/lib/account/home.functions";

export const Route = createFileRoute("/$locale/_main/_app/chat/$id")({
  loader: ({ params }) =>
    chatScreenFn({ data: { id: params.id, locale: params.locale } }),
  head: ({ loaderData }) => ({
    meta: loaderData?.title ? [{ title: loaderData.title }] : [],
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
