"use client";

import { SquareLock01Icon } from "@hugeicons/core-free-icons";
import { useDocumentTitle } from "@mantine/hooks";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { ChatProvider, useChat } from "@/components/ai/chat/context";
import { AiChat } from "@/components/ai/chat/view";
import { Unauthenticated } from "@/components/auth/gate";
import { AuthGoogle } from "@/components/auth/google";

/**
 * The page of one chat. A link can arrive after the address, as a change of its
 * fragment in the same page, so the boundary that shows a chat the viewer may
 * not read tries again when the token changes. The token is compared here and
 * goes nowhere else.
 */
export function AiChatPage({
  chatId,
  shareToken,
}: {
  chatId: Id<"chats">;
  shareToken?: string | undefined;
}) {
  return (
    <ErrorBoundary
      fallback={<AiChatPageError chatId={chatId} />}
      resetKeys={[shareToken]}
    >
      <ChatProvider chatId={chatId} shareToken={shareToken}>
        <AiChatMain />
      </ChatProvider>
    </ErrorBoundary>
  );
}

function AiChatPageError({ chatId }: { chatId: Id<"chats"> }) {
  const t = useTranslations("Ai");

  return (
    <div className="relative flex size-full flex-col overflow-hidden">
      <div className="flex size-full flex-col items-center justify-center">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeIcons icon={SquareLock01Icon} />
            </EmptyMedia>
            <EmptyTitle>{t("private-chat-error")}</EmptyTitle>
            <EmptyDescription>
              {t("private-chat-error-description")}
            </EmptyDescription>
          </EmptyHeader>
          <Unauthenticated>
            <AuthGoogle redirect={`/chat/${chatId}`} />
          </Unauthenticated>
        </Empty>
      </div>
    </div>
  );
}

function AiChatMain() {
  const chat = useChat((s) => s.chat);

  useDocumentTitle(chat?.title ?? "");

  return <AiChat />;
}
