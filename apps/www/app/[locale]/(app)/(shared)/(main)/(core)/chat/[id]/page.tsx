"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useParams } from "next/navigation";
import { Suspense, useSyncExternalStore } from "react";
import { ChatHeader } from "@/components/ai/chat/header";
import { readShareToken } from "@/components/ai/chat/link";
import { AiChatPage } from "@/components/ai/chat/page";

/** URL params resolve synchronously on client navigation, preserving the prompt. */
export default function Page() {
  return (
    <Suspense fallback={<ChatHeader />}>
      <ChatRoute />
    </Suspense>
  );
}

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
  const { id } = useParams<{ id: Id<"chats"> }>();
  const fragment = useSyncExternalStore(
    subscribe,
    readFragment,
    readServerFragment
  );
  if (fragment === null) {
    return <ChatHeader />;
  }
  return (
    <AiChatPage
      chatId={id}
      key={id}
      shareToken={fragment === "" ? undefined : fragment}
    />
  );
}
