import type { Ref } from "@confect/core";
import type classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Array as Arr, Option } from "effect";
import { useState } from "react";
import {
  Panes,
  PanesList,
  PanesProvider,
} from "@/components/shared/page/panes";
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
 * thread, so a thread opens from the message the reader pressed before the server answers.
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
              {Option.match(channelId, {
                // A discussion the server has not answered for yet keeps the chat's place empty.
                onNone: () =>
                  view._tag === "forum" ? (
                    <ForumPick />
                  ) : (
                    <div className="flex-1" />
                  ),
                onSome: (id) => (
                  <ForumChannel
                    canManage={canManage}
                    canPost={canPost}
                    channelId={id}
                    everyone={everyone}
                    jump={view._tag === "channel" ? view.jump : Option.none()}
                    key={id}
                  />
                ),
              })}
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
