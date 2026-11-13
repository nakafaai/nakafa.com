import type { Ref } from "@confect/core";
import type { Id } from "@repo/backend/confect/_generated/id";
import type classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Array as Arr, Option, Order } from "effect";
import { useState } from "react";
import { Panes, PanesList, PanesProvider } from "@/components/shared/panes";
import { ForumChannel } from "@/components/tenant/classes/forum/channel";
import { ForumFrame, ForumPick } from "@/components/tenant/classes/forum/frame";
import {
  type OpenedThread,
  OpenRootContext,
  useOpening,
} from "@/components/tenant/classes/forum/open";
import { StartDiscussion } from "@/components/tenant/classes/forum/start";
import { ThreadPane } from "@/components/tenant/classes/forum/thread";
import { ClassHeader } from "@/components/tenant/classes/header";
import { useClassScope } from "@/components/tenant/classes/scope";
import type { ClassView } from "@/components/tenant/classes/view";

/** What a forum page shows: the list of chats, one chat, or one discussion beside its chat. */
type ForumView = Extract<
  typeof ClassView.Type,
  { _tag: "channel" | "discussion" | "forum" }
>;

/** How many chats the forum keeps drawn: the open one and the last ones the reader left, so going back waits on nothing. */
const KEPT_CHATS = 3;

/** One discussion as its own page reads it from the server. */
type FoundThread = Ref.Returns<typeof classroom.forum.threads.get>;

/** The thread the pane shows: the discussion the address names, read from the server or from the press that opened it. */
function useShownThread(
  view: ForumView,
  found: Option.Option<FoundThread>
): Option.Option<typeof OpenedThread.Type> {
  const opened = useOpening((state) => state.opened);

  if (view._tag !== "discussion") {
    return Option.none();
  }
  return Option.orElse(
    Option.map(
      Option.filter(
        found,
        (thread) => thread.discussion.number === view.number
      ),
      (thread) => ({
        channelId: thread.channelId,
        number: thread.discussion.number,
        opening: thread.opening,
      })
    ),
    () => Option.filter(opened, (thread) => thread.number === view.number)
  );
}

/**
 * The forum of a class as one page that stays mounted while the reader moves between its chat and the chat's
 * threads, as Slack and Discord keep a channel while a thread opens beside it: the header with New discussion, the
 * list of chats beside the open chat, and the thread pane at the screen's right. The forum's route keeps the pressed
 * thread, so a thread opens from the message the reader pressed before the server answers. The forum keeps the last
 * chats the reader opened drawn out of sight, and reads ahead the chat they reach for in the list, so a chat opens,
 * and opens again, with its messages already there.
 */
export function ForumBody({
  archived,
  found,
  view,
}: {
  /** Whether the chat on the page is archived, so it takes nothing new. */
  archived: boolean;
  found: Option.Option<FoundThread>;
  view: ForumView;
}) {
  const { can, opens } = useClassScope();
  const thread = useShownThread(view, found);
  const canManage = Arr.contains(can, "forum.manage");
  const canPost = Arr.contains(can, "forum.post") && !archived;
  // A subject teacher, the one who posts announcements, may mention everyone (ADR 0025).
  const everyone = Arr.contains(can, "post.publish");
  const known =
    view._tag === "channel"
      ? Option.some(view.channelId)
      : Option.map(thread, (shown) => shown.channelId);
  // A discussion opened from the list of threads waits for the server to name its chat, and the chat shown last
  // stays meanwhile, so the page never empties between the two.
  const [last, setLast] = useState(known);
  if (
    Option.isSome(known) &&
    !Option.exists(last, (kept) => kept === known.value)
  ) {
    setLast(known);
  }
  const channelId =
    view._tag === "forum" ? Option.none() : Option.orElse(known, () => last);
  // The chats kept drawn, the open one first, and the chat the reader reaches for in the list, read ahead.
  const [kept, setKept] = useState<readonly Id<"classroomChannels">[]>([]);
  if (
    Option.isSome(channelId) &&
    !Option.contains(Arr.head(kept), channelId.value)
  ) {
    setKept(
      Arr.take(
        Arr.prepend(
          Arr.filter(kept, (id) => id !== channelId.value),
          channelId.value
        ),
        KEPT_CHATS
      )
    );
  }
  const reaching = useOpening((state) => state.reaching);
  // Drawn in one order whatever was opened last, so showing another chat moves none of them in the page.
  const chats = Arr.sort(
    Arr.dedupe(Arr.appendAll(kept, Option.toArray(reaching))),
    Order.String
  );

  return (
    <OpenRootContext
      value={Option.map(thread, (shown) => shown.opening.clientKey)}
    >
      <PanesProvider>
        <ClassHeader>
          {opens && Option.isSome(channelId) ? (
            <StartDiscussion channelId={channelId.value} />
          ) : null}
        </ClassHeader>
        <Panes fill="parent" id="thread">
          <PanesList wide>
            <ForumFrame shown={view._tag === "forum" ? "rail" : "chat"}>
              <div className="relative flex min-h-0 flex-1 flex-col">
                {view._tag === "forum" ? <ForumPick /> : null}
                {/* A discussion the server has not answered for yet keeps the chat's place empty. */}
                {view._tag !== "forum" && Option.isNone(channelId) ? (
                  <div className="flex-1" />
                ) : null}
                {Arr.map(chats, (id) => (
                  <ForumChannel
                    canManage={canManage}
                    canPost={canPost}
                    channelId={id}
                    everyone={everyone}
                    jump={
                      view._tag === "channel" && view.channelId === id
                        ? view.jump
                        : Option.none()
                    }
                    key={id}
                    shown={Option.contains(channelId, id)}
                  />
                ))}
              </div>
            </ForumFrame>
          </PanesList>
          <ThreadPane
            asked={view._tag === "discussion"}
            canManage={canManage}
            canPost={canPost}
            everyone={everyone}
            jump={view._tag === "discussion" ? view.jump : Option.none()}
            thread={thread}
          />
        </Panes>
      </PanesProvider>
    </OpenRootContext>
  );
}
