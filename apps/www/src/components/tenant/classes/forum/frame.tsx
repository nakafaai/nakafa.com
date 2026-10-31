import { cva } from "class-variance-authority";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { TableEmpty } from "@/components/shared/table/frame";
import { ChatRail } from "@/components/tenant/classes/forum/rail";

/** The class's chats, which stand beside the open chat on a laptop and fill a phone until one opens. */
const railPlace = cva("min-h-0 w-full shrink-0 flex-col border-e lg:w-72", {
  variants: {
    shown: { chat: "hidden lg:flex", rail: "flex", thread: "hidden xl:flex" },
  },
});

/** The open chat, which takes the room the list leaves. On a phone the list alone stands until a chat opens. */
const chatPlace = cva("min-h-0 min-w-0 flex-1 flex-col", {
  variants: {
    shown: { chat: "flex", rail: "hidden lg:flex", thread: "flex" },
  },
});

/**
 * The forum of a class as a chat app lays it out: the list of its chats beside the open chat, at the
 * page's width, so moving from one chat to the next is one press. A phone shows one of the two: the
 * list until a chat opens, as WhatsApp does, and the path above leads back to it. A discussion needs
 * the room beside its chat, so the list joins it only on a wide screen.
 */
export function ForumFrame({
  children,
  shown,
}: {
  children: ReactNode;
  /** What the page opens: the list alone, one chat, or one discussion beside its chat. */
  shown: "chat" | "rail" | "thread";
}) {
  const t = useTranslations("Classroom");

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1">
      <aside aria-label={t("channels-title")} className={railPlace({ shown })}>
        <ChatRail />
      </aside>
      <div className={chatPlace({ shown })}>{children}</div>
    </div>
  );
}

/** The place of the open chat while none is open. */
export function ForumPick() {
  const t = useTranslations("Classroom");

  return (
    <div className="flex flex-1 items-center justify-center">
      <TableEmpty
        act="typing"
        description={t("chat-pick-description")}
        title={t("chat-pick")}
      />
    </div>
  );
}
