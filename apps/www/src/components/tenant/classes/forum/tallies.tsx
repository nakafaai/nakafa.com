import { QueryResult, useMutation, useQuery } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Button } from "@repo/design-system/components/ui/button";
import { cva } from "class-variance-authority";
import { Array as Arr, Option } from "effect";
import { createContext, type ReactNode, use, useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import {
  EmojiPopover,
  EmojiTrigger,
} from "@/components/tenant/classes/forum/chooser";
import { QUICK_EMOJI } from "@/components/tenant/classes/forum/emoji";
import { isPending } from "@/components/tenant/classes/forum/marks";
import type { ForumMessage } from "@/components/tenant/classes/forum/optimistic";
import {
  useChannelScope,
  useReadPlace,
} from "@/components/tenant/classes/forum/scope";
import {
  type ForumTally,
  reactUpdate,
} from "@/components/tenant/classes/forum/tally";
import { IconTip } from "@/components/tenant/classes/forum/tip";

/** The tallies of the messages a place has loaded. */
const TalliesContext = createContext<readonly ForumTally[]>([]);

/**
 * Reads the tallies of a place from its oldest loaded message on, apart from its messages, so a class
 * that reacts never reads a page of messages again. While older history loads the last answer stays,
 * so no reaction blinks.
 */
export function TalliesProvider({
  children,
  since,
}: {
  children: ReactNode;
  /** When the oldest loaded message came. */
  since: number;
}) {
  const { classId, slug } = useChannelScope();
  const place = useReadPlace();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const read = useQuery(
    classroom.forum.tallies.since,
    isSettled ? { classId, place, since, slug } : "skip"
  );
  const [kept, setKept] = useState<readonly ForumTally[]>([]);
  if (QueryResult.isSuccess(read) && read.value !== kept) {
    setKept(read.value);
  }

  return <TalliesContext value={kept}>{children}</TalliesContext>;
}

/** The tally of one message, if it holds one. */
export function useTally(messageId: ForumMessage["id"]) {
  return Arr.findFirst(
    use(TalliesContext),
    (tally) => tally.messageId === messageId
  );
}

/** Sends the viewer's press on an emoji, shown at once. */
function useReact(messageId: ForumMessage["id"]) {
  const { classId, slug } = useChannelScope();
  const react = useMutation(classroom.forum.tallies.react);

  return (emoji: string) =>
    runForumCall(
      forumCall(() =>
        react.withOptimisticUpdate(reactUpdate)({
          classId,
          emoji,
          messageId,
          slug,
        })
      ),
      toastForumFailure
    );
}

/** One emoji of a message and its count, on the secondary surface when the viewer gave it. */
const reactionChip = cva("gap-1.5 rounded-full px-3 tabular-nums", {
  variants: {
    mine: {
      false: "bg-muted/60 border-transparent",
      true: "border-border bg-accent text-accent-foreground",
    },
  },
});

/**
 * The emoji a message carries, under its bubble, as WhatsApp and Discord show them: each with its
 * count, and a press gives it or takes it back. A leader who reads the class sees them and presses none.
 */
export function MessageReactions({ message }: { message: ForumMessage }) {
  const t = useTranslations("Classroom");
  const tally = useTally(message.id);
  const { canPost } = useChannelScope();
  const press = useReact(message.id);

  if (Option.isNone(tally) || Arr.isReadonlyArrayEmpty(tally.value.reactions)) {
    return null;
  }
  return (
    <div
      className="flex flex-wrap gap-1 px-1 data-[mine=true]:justify-end"
      data-mine={message.mine}
    >
      {Arr.map(tally.value.reactions, (reaction) => (
        <Button
          aria-label={t("reaction-label", {
            count: reaction.count,
            emoji: reaction.emoji,
          })}
          aria-pressed={reaction.mine}
          className={reactionChip({ mine: reaction.mine })}
          disabled={!canPost}
          key={reaction.emoji}
          onClick={() => press(reaction.emoji)}
          variant="outline"
        >
          <span>{reaction.emoji}</span>
          {reaction.count}
        </Button>
      ))}
    </div>
  );
}

/**
 * Gives a message an emoji: the six a chat reaches for most, one press each, and the whole chooser under them. With a
 * mouse it shows on the message's hover or focus; a touch screen always shows it. A message the server is still
 * saving takes no emoji yet, since it has no ID to give one to.
 */
export function ReactButton({ message }: { message: ForumMessage }) {
  const t = useTranslations("Classroom");
  const press = useReact(message.id);

  return (
    <EmojiPopover onPick={press} quick={QUICK_EMOJI}>
      <IconTip label={t("reaction-add")}>
        <EmojiTrigger
          render={
            <Button
              aria-label={t("reaction-add")}
              disabled={isPending(message)}
              size="icon"
              variant="ghost"
            />
          }
        />
      </IconTip>
    </EmojiPopover>
  );
}
