import { cva } from "class-variance-authority";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import {
  pageBoxVariants,
  pageGutterVariants,
} from "@/components/shared/content/width";
import { Panes, PanesList, PanesRail } from "@/components/shared/panes";
import { EmptyState } from "@/components/state/empty";
import { EmptyNina } from "@/components/state/nina";
import { ChatRail } from "@/components/tenant/classes/forum/rail";

/** The class's chats keep the page's gutter, so its search, its tabs and its rows stand on the header's first letter. */
const railPlace = cva(
  `flex min-h-0 flex-1 flex-col ${pageGutterVariants()} lg:pe-0`
);

/** The forum stands in the header's frame, so on a wide screen its list and its chat never reach past the header. */
const forumBox = cva(`${pageBoxVariants()} flex min-h-0 flex-1 flex-col`);

/**
 * The forum of a class as a chat app lays it out: the list of its chats beside the open chat, in the
 * header's frame, with the handle between them that a person drags, so moving from one chat to the next
 * is one press. A phone shows one of the two: the list until a chat opens, as WhatsApp does, and the
 * path above leads back to it. A discussion needs the room beside its chat, so the list joins it only
 * on a wide screen.
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
    <div className={forumBox()}>
      <Panes
        fill="parent"
        id="forum"
        inRow
        keeps={shown === "rail" ? "first" : "second"}
        wideFrom={shown === "thread" ? "xl" : "lg"}
      >
        <PanesRail label={t("channels-title")}>
          <div className={railPlace()}>
            <ChatRail />
          </div>
        </PanesRail>
        <PanesList>{children}</PanesList>
      </Panes>
    </div>
  );
}

/** The place of the open chat while none is open. */
export function ForumPick() {
  const t = useTranslations("Classroom");

  return (
    <div className="flex flex-1 items-center justify-center">
      <EmptyState
        description={t("chat-pick-description")}
        scene={<EmptyNina act="typing" />}
        title={t("chat-pick")}
      />
    </div>
  );
}
