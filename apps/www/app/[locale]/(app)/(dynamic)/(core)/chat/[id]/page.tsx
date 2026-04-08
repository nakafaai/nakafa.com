import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { cache, use } from "react";
import { AiChatPage } from "@/components/ai/chat-page";
import { getToken } from "@/lib/auth/server";

interface Props {
  params: Promise<{
    locale: Locale;
    id: Id<"chats">;
  }>;
}

const getChatTitle = cache(async (id: Id<"chats">) => {
  const token = await getToken();

  return await fetchQuery(
    api.chats.queries.getChatTitle,
    { chatId: id },
    token ? { token } : undefined
  );
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const defaultMetadata = {};
  // Use try-catch to handle errors gracefully when title is not found
  try {
    const title = await getChatTitle(id);
    if (!title) {
      return defaultMetadata;
    }
    return {
      title: {
        absolute: title,
      },
    };
  } catch {
    return defaultMetadata;
  }
}

export default function Page({ params }: Props) {
  const { locale, id } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  return <AiChatPage chatId={id} />;
}
