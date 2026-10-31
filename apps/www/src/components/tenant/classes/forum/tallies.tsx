import { QueryResult, useMutation, useQuery } from "@confect/react";
import { SmileIcon } from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
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
import { EMOJI, QUICK_EMOJI } from "@/components/tenant/classes/forum/emoji";
import type { ForumMessage } from "@/components/tenant/classes/forum/optimistic";
import {
  useChannelScope,
  useReadPlace,
} from "@/components/tenant/classes/forum/scope";
import {
  type ForumTally,
  reactUpdate,
} from "@/components/tenant/classes/forum/tally";

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

/** One emoji of a message and its count, marked when the viewer gave it. */
const reactionChip = cva("h-7 gap-1 rounded-full px-2 text-xs tabular-nums", {
  variants: {
    mine: {
      false: "bg-muted/60 border-transparent",
      true: "border-primary bg-primary/10",
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
          size="sm"
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
 * The emoji of a chat in one grid, the first row the ones a press on a message reaches for most.
 * Choosing one runs `onPick`, and a phone keeps its own keyboard's emoji beside it.
 */
export function EmojiGrid({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div className="grid max-h-64 grid-cols-8 gap-0.5 overflow-y-auto">
      {Arr.map(EMOJI, (emoji) => (
        <Button
          aria-label={emoji}
          className="text-base"
          key={emoji}
          onClick={() => onPick(emoji)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          {emoji}
        </Button>
      ))}
    </div>
  );
}

/**
 * Gives a message an emoji: the six a chat reaches for most, one press each, and the whole grid
 * under them. With a mouse it shows on the message's hover or focus; a touch screen always shows it.
 */
export function ReactButton({ message }: { message: ForumMessage }) {
  const t = useTranslations("Classroom");
  const [open, setOpen] = useState(false);
  const press = useReact(message.id);

  /** Gives the chosen emoji and closes the panel. */
  const pick = (emoji: string) => {
    setOpen(false);
    press(emoji);
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-label={t("reaction-add")}
            className="shrink-0 pointer-fine:opacity-0 pointer-fine:group-focus-within/row:opacity-100 pointer-fine:group-hover/row:opacity-100 pointer-fine:data-popup-open:opacity-100"
            size="icon-xs"
            title={t("reaction-add")}
            variant="ghost"
          >
            <HugeIcons icon={SmileIcon} />
          </Button>
        }
      />
      <PopoverContent align="center" className="w-auto gap-2 p-2">
        <div className="flex justify-between gap-1 border-b pb-2">
          {Arr.map(QUICK_EMOJI, (emoji) => (
            <Button
              aria-label={emoji}
              className="text-lg"
              key={emoji}
              onClick={() => pick(emoji)}
              size="icon-sm"
              variant="ghost"
            >
              {emoji}
            </Button>
          ))}
        </div>
        <EmojiGrid onPick={pick} />
      </PopoverContent>
    </Popover>
  );
}
