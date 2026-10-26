import { useMutation } from "@confect/react";
import { useDebouncedValue } from "@mantine/hooks";
import type { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import type { ReadPlace } from "@repo/backend/confect/classroom/forum/read";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Marker,
  MarkerContent,
} from "@repo/design-system/components/ui/marker";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
} from "@repo/design-system/components/ui/scroller";
import {
  MessageScroller as Primitive,
  useMessageScroller,
  useMessageScrollerVisibility,
} from "@shadcn/react/message-scroller";
import { Array as Arr, DateTime, Option } from "effect";
import { useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import {
  forumCall,
  runForumCall,
} from "@/components/tenant/classes/forum/call";
import {
  firstUnread,
  headToKeep,
  newestSeen,
  opensDay,
  opensRun,
} from "@/components/tenant/classes/forum/marks";
import { ForumMessageRow } from "@/components/tenant/classes/forum/message";
import {
  type ForumMessage,
  markUpdate,
} from "@/components/tenant/classes/forum/optimistic";
import { useChannelScope } from "@/components/tenant/classes/forum/scope";

/** How long the reader's view stays still before the read mark moves to it. */
const MARK_DELAY_MILLISECONDS = 600;

/**
 * The messages of one place, a channel or a discussion, oldest at the top, each day's first under
 * a divider with its day, in a scroller that keeps
 * the reader's place (ADR 0025). It opens at the first message another member wrote after the read
 * mark the place had when it opened, under a divider that stays where it was while the reader
 * reads, or at the newest edge when nothing is unread. It follows the newest edge only while the
 * reader is there, loads older history upward without moving the reader, and jumps to the message
 * the address names, loading older pages until it is there. The read mark follows the newest
 * message the reader has in view.
 */
export function MessageStream({
  at,
  jump,
  loadOlder,
  messages,
  opening,
  place,
}: {
  /** The read mark of the place now, which only moves forward. */
  at: number | null;
  /** The message the address asks to show, if any. */
  jump: Option.Option<Id<"classroomMessages">>;
  /** Loads the next older page, while the place holds one. */
  loadOlder: (() => void) | undefined;
  /** The loaded messages, oldest first. */
  messages: readonly ForumMessage[];
  /** A discussion's opening message, which stands above the oldest reply once the whole history is loaded. */
  opening: Option.Option<ForumMessage>;
  place: typeof ReadPlace.Type;
}) {
  const t = useTranslations("Classroom");
  const format = useFormatter();
  // The reader's day of a time, which the divider above each day's first message shows.
  const dayOf = (time: number) =>
    format.dateTime(DateTime.toDateUtc(DateTime.makeUnsafe(time)), {
      dateStyle: "long",
    });
  // The first unread message when the reader opened the place: the place opens there, and the
  // divider stays there while the reader reads. A message that arrives later is never the anchor,
  // so it never moves a reader who is not at the newest edge.
  const [unread] = useState(() => firstUnread(messages, at));
  // The oldest loaded message keeps its author line when older history arrives, as React keeps state
  // from the previous render, so the message the reader looks at never moves by that line.
  const [kept, setKept] = useState<readonly string[]>([]);
  const head = headToKeep(messages, loadOlder !== undefined, kept);
  if (Option.isSome(head)) {
    setKept(Arr.append(kept, head.value));
  }
  // The divider marks where unread messages start, so it shows only once the message before it is
  // loaded, or when the place holds nothing older.
  const divided = Option.filter(
    unread,
    (key) =>
      loadOlder === undefined ||
      Option.exists(Arr.head(messages), (first) => first.clientKey !== key)
  );

  return (
    <Primitive.Provider autoScroll defaultScrollPosition="last-anchor">
      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport
          aria-label={t("messages")}
          preserveScrollOnPrepend
        >
          <MessageScrollerContent className="w-full gap-4 px-4 py-4">
            {loadOlder === undefined && Option.isSome(opening) ? (
              <MessageScrollerItem>
                <Marker className="mb-4" role="separator" variant="separator">
                  <MarkerContent>
                    {dayOf(opening.value.createdAt)}
                  </MarkerContent>
                </Marker>
                <ForumMessageRow message={opening.value} opens />
              </MessageScrollerItem>
            ) : null}
            {Arr.map(messages, (message, index) => (
              // The client key stays the same from the send to the server's answer, so the row
              // and anything open in it outlive the placeholder ID.
              <MessageScrollerItem
                className="rounded-xl transition-colors data-[jumped=true]:bg-muted/60"
                data-jumped={
                  Option.contains(jump, message.id) ? "true" : undefined
                }
                key={message.clientKey}
                messageId={message.clientKey}
                scrollAnchor={Option.contains(unread, message.clientKey)}
              >
                {index === 0 && loadOlder ? (
                  <Intersection onIntersect={loadOlder} />
                ) : null}
                {Option.match(
                  opensDay(
                    messages,
                    index,
                    loadOlder !== undefined,
                    opening,
                    dayOf
                  ),
                  {
                    onNone: () => null,
                    onSome: (day) => (
                      <Marker
                        className="mb-4"
                        role="separator"
                        variant="separator"
                      >
                        <MarkerContent>{day}</MarkerContent>
                      </Marker>
                    ),
                  }
                )}
                {Option.contains(divided, message.clientKey) ? (
                  <Marker className="mb-4" role="separator" variant="separator">
                    <MarkerContent>{t("unread-divider")}</MarkerContent>
                  </Marker>
                ) : null}
                <ForumMessageRow
                  message={message}
                  opens={opensRun(messages, index, kept)}
                />
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton aria-label={t("scroll-to-latest")} />
      </MessageScroller>
      <ReadTracker at={at} messages={messages} place={place} />
      <JumpTo jump={jump} loadOlder={loadOlder} messages={messages} />
    </Primitive.Provider>
  );
}

/**
 * Moves the viewer's read mark to the newest message in view once the view has been still for a
 * moment, so scrolling through history writes once. A mark that would not move is not sent.
 */
function ReadTracker({
  at,
  messages,
  place,
}: {
  at: number | null;
  messages: readonly ForumMessage[];
  place: typeof ReadPlace.Type;
}) {
  const { classId, slug } = useChannelScope();
  const mark = useMutation(classroom.forum.reads.mark);
  const { visibleMessageIds } = useMessageScrollerVisibility();
  const seen = Option.getOrNull(newestSeen(messages, visibleMessageIds));
  const [settled] = useDebouncedValue(seen, MARK_DELAY_MILLISECONDS);

  useEffect(() => {
    if (settled === null || (at !== null && settled <= at)) {
      return;
    }
    runForumCall(
      forumCall(() =>
        mark.withOptimisticUpdate(markUpdate)({
          at: settled,
          classId,
          place,
          slug,
        })
      ),
      () => undefined
    );
  }, [at, classId, mark, place, settled, slug]);

  return null;
}

/**
 * Brings the message the address names into view once, in the middle of the view. While it is not
 * loaded and older pages remain, the next older page loads.
 */
function JumpTo({
  jump,
  loadOlder,
  messages,
}: {
  jump: Option.Option<Id<"classroomMessages">>;
  loadOlder: (() => void) | undefined;
  messages: readonly ForumMessage[];
}) {
  const { scrollToMessage } = useMessageScroller();
  const done = useRef(false);
  const asked = useRef(0);
  const target = Option.flatMap(jump, (id) =>
    Arr.findFirst(messages, (message) => message.id === id)
  );

  useEffect(() => {
    if (done.current || Option.isNone(jump)) {
      return;
    }
    if (Option.isSome(target)) {
      scrollToMessage(target.value.clientKey, { align: "center" });
      done.current = true;
      return;
    }
    if (loadOlder !== undefined && asked.current !== messages.length) {
      asked.current = messages.length;
      loadOlder();
    }
  }, [jump, loadOlder, messages.length, scrollToMessage, target]);

  return null;
}
