import { captureServerException } from "@repo/analytics/posthog/server";
import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import { toConvexReference } from "@repo/backend/confect/modules/shared/convexReferences";
import { fetchQuery } from "convex/nextjs";
import { Either } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache, Suspense, use } from "react";
import { AiChatPage } from "@/components/ai/chat-page";
import { getToken } from "@/lib/auth/server";
import { decodeChatId } from "@/lib/data/convex-ids";

/** Loads the current chat title once per request for metadata generation. */
const getChatTitle = cache(async (id: Id<"chats">) => {
  const token = await getToken();

  return await fetchQuery(
    toConvexReference(refs.public.chats.queries.getChatTitle),
    { chatId: id },
    token ? { token } : undefined
  );
});

/** Generates the metadata for one authenticated chat route. */
export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/chat/[id]">["params"];
}): Promise<Metadata> {
  const { id } = await params;
  const defaultMetadata = {};
  const chatId = decodeChatId(id);

  if (Either.isLeft(chatId)) {
    return defaultMetadata;
  }

  // Use try-catch to handle errors gracefully when title is not found
  try {
    const title = await getChatTitle(chatId.right);
    if (!title) {
      return defaultMetadata;
    }
    return {
      title: {
        absolute: title,
      },
    };
  } catch (error) {
    await captureServerException(error, undefined, {
      chat_id: id,
      source: "chat-page-metadata",
    });

    return defaultMetadata;
  }
}

/** Renders the chat route with a local Suspense boundary for runtime params. */
export default function Page(props: PageProps<"/[locale]/chat/[id]">) {
  const { params } = props;

  return (
    <Suspense
      fallback={
        <div className="relative flex size-full flex-col overflow-hidden" />
      }
    >
      <ChatRouteContent params={params} />
    </Suspense>
  );
}

/** Resolves the runtime chat id inside the nearest Suspense boundary. */
function ChatRouteContent({
  params,
}: {
  params: PageProps<"/[locale]/chat/[id]">["params"];
}) {
  const { id } = use(params);
  const chatId = decodeChatId(id);

  if (Either.isLeft(chatId)) {
    notFound();
  }

  return <AiChatPage chatId={chatId.right} />;
}
