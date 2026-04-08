import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { cache, use } from "react";
import { AiChatPage } from "@/components/ai/chat-page";
import { getToken } from "@/lib/auth/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";

const getChatTitle = cache(async (id: Id<"chats">) => {
  const token = await getToken();

  return await fetchQuery(
    api.chats.queries.getChatTitle,
    { chatId: id },
    token ? { token } : undefined
  );
});

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/chat/[id]">["params"];
}): Promise<Metadata> {
  const { id } = await params;
  const defaultMetadata = {};
  // Use try-catch to handle errors gracefully when title is not found
  try {
    const title = await getChatTitle(id as Id<"chats">);
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

export default function Page(props: PageProps<"/[locale]/chat/[id]">) {
  const { params } = props;
  const { locale: rawLocale, id } = use(params);
  const locale = getLocaleOrThrow(rawLocale);

  // Enable static rendering
  setRequestLocale(locale);

  return <AiChatPage chatId={id as Id<"chats">} />;
}
