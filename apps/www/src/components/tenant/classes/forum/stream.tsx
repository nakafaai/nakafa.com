import { useMutation } from "@confect/react";
import { useDebouncedValue } from "@mantine/hooks";
import type { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
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
import { cn } from "cn";
import { Array as Arr, DateTime, Option } from "effect";
import { use, useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import {
  pageGutterVariants,
  readingMeasureVariants,
} from "@/components/shared/content/width";
import { KeepPlace, useKeptPlace } from "@/components/shared/place";
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
import {
  PlaceShownContext,
  useChannelScope,
  usePlaceChat,
  useReadPlace,
} from "@/components/tenant/classes/forum/scope";
import { TalliesProvider } from "@/components/tenant/classes/forum/tallies";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";

/** How long the reader's view stays still before the read mark moves to it. */
const MARK_DELAY_MILLISECONDS = 600;

/**
 * The messages of one place, a channel or a discussion, oldest at the top, each day's first under
 * a divider with its day, in a scroller that keeps
 * the reader's place (ADR 0025). It opens at the first message another member wrote after the read
 * mark the place had when it opened, under a divider that stays where it was while the reader
 * reads; when nothing is unread, where the reader left it in this browser (`KeepPlace`), or at the
 * newest edge. It follows the newest edge only while the
 * reader is there, loads older history upward without moving the reader, and jumps to the message
 * the address names for the place, loading older pages until it is there. The read mark follows the newest
 * message the reader has in view.
 */
export function MessageStream({
  at,
  loadOlder,
  messages,
  opening,
}: {
  /** The read mark of the place now, which only moves forward. */
  at: number | null;
  /** Loads the next older page, while the place holds one. */
  loadOlder: (() => void) | undefined;
  /** The loaded messages, oldest first. */
  messages: readonly ForumMessage[];
  /** A discussion's opening message, which stands above the oldest reply once the whole history is loaded. */
  opening: Option.Option<ForumMessage>;
}) {
  const t = useTranslations("Classroom");
  const format = useFormatter();
  // The message the address asks this place to bring into view, if any.
  const { jump } = useChannelScope();
  // The reader's day of a time, which the divider above each day's first message shows.
  const dayOf = (time: number) =>
    format.dateTime(DateTime.toDateUtc(DateTime.makeUnsafe(time)), {
      dateStyle: "long",
    });
  // The first unread message when the reader opened the place: the place opens there, and the
  // divider stays there while the reader reads. A message that arrives later is never the anchor,
  // so it never moves a reader who is not at the newest edge.
  const [unread] = useState(() => firstUnread(messages, at));
  const chat = usePlaceChat();
  const left = useKeptPlace(chat);
  // An unread message or the message the address names decides where the place opens; otherwise the kept place does.
  const restore =
    Option.isNone(unread) && Option.isNone(jump) ? left : Option.none();
  const viewport = useRef<HTMLDivElement>(null);
  // The oldest loaded message keeps its author line when older history arrives, as React keeps state
  // from the previous render, so the message the reader looks at never moves by that line.
  const [kept, setKept] = useState<readonly string[]>([]);
  const head = headToKeep(messages, loadOlder !== undefined, kept);
  if (Option.isSome(head)) {
    setKept(Arr.append(kept, head.value));
  }
  /** The day the message at `index` opens, which a divider shows above it. */
  const dayAt = (index: number) =>
    opensDay(messages, index, loadOlder !== undefined, opening, dayOf);
  // The divider marks where unread messages start, so it shows only once the message before it is
  // loaded, or when the place holds nothing older.
  const divided = Option.filter(
    unread,
    (key) =>
      loadOlder === undefined ||
      Option.exists(Arr.head(messages), (first) => first.clientKey !== key)
  );

  /**
   * Whether the message at `index` opens a run, under its own header: a new day, the unread divider above it, or what
   * `opensRun` says.
   */
  const opensAt = (index: number) =>
    Option.isSome(dayAt(index)) ||
    Option.exists(Arr.get(messages, index), (message) =>
      Option.contains(divided, message.clientKey)
    ) ||
    opensRun(messages, index, kept);

  return (
    <TalliesProvider
      since={Option.match(Arr.head(messages), {
        onNone: () => 0,
        onSome: (oldest) => oldest.createdAt,
      })}
    >
      <Primitive.Provider autoScroll defaultScrollPosition="last-anchor">
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport
            aria-label={t("messages")}
            preserveScrollOnPrepend
            ref={viewport}
          >
            <MessageScrollerContent
              className={cn(
                readingMeasureVariants(),
                pageGutterVariants(),
                "gap-0.5 py-4"
              )}
            >
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
              {Arr.map(messages, (message, index) => {
                const day = dayAt(index);
                return (
                  // The client key stays the same from the send to the server's answer, so the row
                  // and anything open in it outlive the placeholder ID.
                  <MessageScrollerItem
                    className="data-[jumped=true]:bg-muted/60 rounded-2xl transition-colors"
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
                    {Option.match(day, {
                      onNone: () => null,
                      onSome: (shown) => (
                        <Marker
                          className="mb-4"
                          role="separator"
                          variant="separator"
                        >
                          <MarkerContent>{shown}</MarkerContent>
                        </Marker>
                      ),
                    })}
                    {Option.contains(divided, message.clientKey) ? (
                      <Marker
                        className="mb-4"
                        role="separator"
                        variant="separator"
                      >
                        <MarkerContent>{t("unread-divider")}</MarkerContent>
                      </Marker>
                    ) : null}
                    <ForumMessageRow message={message} opens={opensAt(index)} />
                  </MessageScrollerItem>
                );
              })}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton label={t("scroll-to-latest")} />
        </MessageScroller>
        <KeepPlace chat={chat} restore={restore} viewport={viewport} />
        <ReadTracker at={at} messages={messages} />
        <JumpTo jump={jump} loadOlder={loadOlder} messages={messages} />
      </Primitive.Provider>
    </TalliesProvider>
  );
}

/**
 * Moves the viewer's read mark to the newest message in view once the view has been still for a
 * moment, so scrolling through history writes once. A mark that would not move is not sent, and a
 * place out of sight moves none.
 */
function ReadTracker({
  at,
  messages,
}: {
  at: number | null;
  messages: readonly ForumMessage[];
}) {
  const { classId, slug } = useChannelScope();
  const shown = use(PlaceShownContext);
  const place = useReadPlace();
  const mark = useMutation(classroom.forum.reads.mark);
  const { visibleMessageIds } = useMessageScrollerVisibility();
  const seen = Option.getOrNull(newestSeen(messages, visibleMessageIds));
  const [settled] = useDebouncedValue(seen, MARK_DELAY_MILLISECONDS);

  useEffect(() => {
    // A place read ahead out of sight marks nothing: its messages are in the page, unseen.
    if (!shown || settled === null || (at !== null && settled <= at)) {
      return;
    }
    runSchoolWrite(
      schoolCall(() =>
        mark.withOptimisticUpdate(markUpdate)({
          at: settled,
          classId,
          place,
          slug,
        })
      ),
      { onRefused: () => undefined }
    );
  }, [at, classId, mark, place, settled, shown, slug]);

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
