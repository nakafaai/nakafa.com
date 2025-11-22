import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { FinanceChatPage } from "@/components/finance/chat/page";

type Props = {
  params: Promise<{ locale: Locale; id: Id<"chats"> }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const defaultMetadata = {};
  // Use try-catch to handle errors gracefully when title is not found
  try {
    const title = await fetchQuery(api.chats.queries.getChatTitle, {
      chatId: id,
    });
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

  setRequestLocale(locale);

  return <FinanceChatPage chatId={id} />;
}
