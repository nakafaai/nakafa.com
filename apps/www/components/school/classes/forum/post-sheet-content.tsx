"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { UserData } from "@repo/backend/convex/lib/userHelpers";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@repo/design-system/components/ai/conversation";
import { Response } from "@repo/design-system/components/ai/response";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerSearch,
} from "@repo/design-system/components/ui/emoji-picker";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@repo/design-system/components/ui/hover-card";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@repo/design-system/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { useForm } from "@tanstack/react-form";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { format } from "date-fns";
import {
  ArrowUpIcon,
  CornerDownRightIcon,
  ReplyIcon,
  SmilePlusIcon,
  XIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  Activity,
  type ComponentRef,
  Fragment,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import * as z from "zod/mini";
import { useForum } from "@/lib/context/use-forum";
import { getLocale } from "@/lib/utils/date";
import { getInitialName } from "@/lib/utils/helper";

type Forum = Doc<"schoolClassForums"> & {
  user: UserData | null;
  myReactions: string[]; // Emojis the current user reacted with
  reactionUsers: ReactionWithUsers[]; // Reactions with reactor names
};

type ReactionWithUsers = {
  emoji: string;
  count: number;
  reactors: string[]; // User names who reacted (max 10)
};

type ForumPost = Doc<"schoolClassForumPosts"> & {
  user: UserData | null;
  replyToUser: UserData | null;
  myReactions: string[]; // Emojis the current user reacted with
  reactionUsers: ReactionWithUsers[]; // Reactions with reactor names
};

export function SchoolClassesForumPostSheetContent() {
  const activeForumId = useForum((f) => f.activeForumId);

  if (!activeForumId) {
    return null;
  }

  return <ForumPostList forumId={activeForumId} />;
}

function ForumPostList({ forumId }: { forumId: Id<"schoolClassForums"> }) {
  const forum = useQuery(api.classes.queries.getForum, { forumId });
  const { results, status } = usePaginatedQuery(
    api.classes.queries.getForumPosts,
    { forumId },
    { initialNumItems: 50 }
  );

  if (status === "LoadingFirstPage" || !forum) {
    return null;
  }

  return (
    <div className="relative flex size-full flex-col overflow-hidden">
      <Conversation>
        <ConversationContent className="gap-0 p-0">
          <ForumHeader forum={forum} />

          {results.map((post, index) => {
            const prevPost = results[index - 1];

            // Check if date changed from previous post
            const prevDate = prevPost
              ? new Date(prevPost._creationTime).toDateString()
              : new Date(forum._creationTime).toDateString();
            const currentDate = new Date(post._creationTime).toDateString();
            const showDateSeparator = currentDate !== prevDate;

            // Group posts by same author (consecutive)
            const isFirstInGroup =
              showDateSeparator ||
              !prevPost ||
              prevPost.createdBy !== post.createdBy;

            return (
              <Fragment key={post._id}>
                <Activity
                  mode={showDateSeparator === true ? "visible" : "hidden"}
                >
                  <DateSeparator date={post._creationTime} />
                </Activity>
                <ForumPostItem isFirstInGroup={isFirstInGroup} post={post} />
              </Fragment>
            );
          })}

          <div className="py-4" />
        </ConversationContent>

        <ConversationScrollButton />
      </Conversation>

      <ForumPostInput forumId={forumId} />
    </div>
  );
}

function ForumHeader({ forum }: { forum: Forum }) {
  const t = useTranslations("Common");
  const locale = useLocale();

  const userName = forum.user?.name ?? t("anonymous");
  const userImage = forum.user?.image ?? "";

  return (
    <div className="group flex items-start gap-3 border-primary border-l-2 bg-primary/5 p-4">
      <Avatar className="size-8 shrink-0 rounded-full">
        <AvatarImage alt={userName} src={userImage} />
        <AvatarFallback className="rounded-lg">
          {getInitialName(userName)}
        </AvatarFallback>
      </Avatar>

      <div className="grid min-w-0 flex-1 gap-2">
        <div className="grid gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate font-medium text-sm">
              {userName}
            </span>
            <time className="min-w-0 truncate text-muted-foreground text-xs tracking-tight">
              {format(forum._creationTime, "HH:mm", {
                locale: getLocale(locale),
              })}
            </time>
          </div>

          <div className="wrap-break-word min-w-0 text-chat">
            <Response id={forum._id}>{forum.body}</Response>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ForumReactions forum={forum} />
          <ForumActions forum={forum} />
        </div>
      </div>
    </div>
  );
}

function ForumReactions({ forum }: { forum: Forum }) {
  const t = useTranslations("Common");

  const [isPending, startTransition] = useTransition();
  const toggleReaction = useMutation(api.classes.mutations.toggleForumReaction);

  const handleToggleReaction = (emoji: string) => {
    startTransition(async () => {
      await toggleReaction({ forumId: forum._id, emoji });
    });
  };

  if (forum.reactionUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {forum.reactionUsers.map(({ emoji, count, reactors }) => {
        const isMyReaction = forum.myReactions.includes(emoji);
        const moreCount = count - reactors.length;

        return (
          <HoverCard key={emoji}>
            <HoverCardTrigger asChild>
              <Button
                disabled={isPending}
                onClick={() => handleToggleReaction(emoji)}
                size="sm"
                variant={isMyReaction === true ? "default-outline" : "outline"}
              >
                {emoji}
                <span className="tracking-tight">{count}</span>
              </Button>
            </HoverCardTrigger>
            <HoverCardContent
              align="center"
              className="w-auto max-w-64"
              side="top"
            >
              <div className="flex items-center gap-2">
                <span className="text-3xl">{emoji}</span>
                <p className="line-clamp-2 text-sm leading-tight">
                  {moreCount > 0
                    ? t("reacted-by-more", {
                        names: reactors.join(", "),
                        count: moreCount,
                      })
                    : t("reacted-by", { names: reactors.join(", ") })}
                </p>
              </div>
            </HoverCardContent>
          </HoverCard>
        );
      })}
    </div>
  );
}

function ForumActions({ forum }: { forum: Forum }) {
  const t = useTranslations("Common");

  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const toggleReaction = useMutation(api.classes.mutations.toggleForumReaction);

  const handleToggleReaction = (emoji: string) => {
    startTransition(async () => {
      await toggleReaction({ forumId: forum._id, emoji });
    });
  };

  return (
    <Popover onOpenChange={setIsOpen} open={isOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger asChild>
              <Button disabled={isPending} size="icon-sm" variant="outline">
                <SmilePlusIcon />
              </Button>
            </PopoverTrigger>
          }
        />
        <TooltipContent side="top">{t("reaction")}</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-fit p-0">
        <EmojiPicker
          className="h-80"
          onEmojiSelect={({ emoji }) => {
            handleToggleReaction(emoji);
            setIsOpen(false);
          }}
        >
          <EmojiPickerSearch />
          <EmojiPickerContent />
          <EmojiPickerFooter />
        </EmojiPicker>
      </PopoverContent>
    </Popover>
  );
}

function ForumPostItem({
  post,
  isFirstInGroup,
}: {
  post: ForumPost;
  isFirstInGroup: boolean;
}) {
  const t = useTranslations("Common");
  const locale = useLocale();
  const currentUser = useQuery(api.auth.getCurrentUser);

  const replyTo = useForum((f) => f.replyTo);
  const isReplyTo = replyTo?.postId === post._id;
  const userName = post.user?.name ?? t("anonymous");
  const userImage = post.user?.image ?? "";

  const isReplyToMe =
    currentUser && post.replyToUserId === currentUser.appUser._id;

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 border-l-2 border-l-transparent px-4 py-2 transition-colors ease-out hover:bg-accent/20",

        isReplyToMe === true && "border-primary bg-primary/5",
        isReplyTo === true && "border-secondary bg-secondary/5"
      )}
      id={post._id}
    >
      <ForumPostItemActions post={post} />

      <Activity mode={isFirstInGroup === true ? "visible" : "hidden"}>
        <Avatar className="size-8 shrink-0 rounded-full">
          <AvatarImage alt={userName} src={userImage} />
          <AvatarFallback className="rounded-lg">
            {getInitialName(userName)}
          </AvatarFallback>
        </Avatar>
      </Activity>
      <Activity mode={isFirstInGroup === true ? "hidden" : "visible"}>
        <time
          className="mt-1 w-8 shrink-0 text-center text-muted-foreground text-xs"
          title={format(post._creationTime, "PPpp", {
            locale: getLocale(locale),
          })}
        >
          {format(post._creationTime, "HH:mm", { locale: getLocale(locale) })}
        </time>
      </Activity>

      <div className="grid min-w-0 flex-1 gap-2">
        <div className="grid gap-1">
          <Activity mode={isFirstInGroup === true ? "visible" : "hidden"}>
            <div className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate font-medium text-sm">
                {userName}
              </span>
              <time
                className="min-w-0 truncate text-muted-foreground text-xs tracking-tight"
                title={format(post._creationTime, "PPpp", {
                  locale: getLocale(locale),
                })}
              >
                {format(post._creationTime, "HH:mm", {
                  locale: getLocale(locale),
                })}
              </time>
            </div>
          </Activity>

          <PostReplyIndicator post={post} />

          <div className="wrap-break-word min-w-0 text-chat">
            <Response id={post._id}>{post.body}</Response>
          </div>
        </div>

        <PostReactions post={post} />
      </div>
    </div>
  );
}

function PostReactions({ post }: { post: ForumPost }) {
  const t = useTranslations("Common");

  const [isPending, startTransition] = useTransition();
  const toggleReaction = useMutation(api.classes.mutations.togglePostReaction);

  const handleToggleReaction = (emoji: string) => {
    startTransition(async () => {
      await toggleReaction({ postId: post._id, emoji });
    });
  };

  // Only show when there are reactions
  if (post.reactionUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {post.reactionUsers.map(({ emoji, count, reactors }) => {
        const isMyReaction = post.myReactions.includes(emoji);
        const moreCount = count - reactors.length;

        return (
          <HoverCard key={emoji}>
            <HoverCardTrigger asChild>
              <Button
                disabled={isPending}
                onClick={() => handleToggleReaction(emoji)}
                size="sm"
                variant={isMyReaction === true ? "default-outline" : "outline"}
              >
                {emoji}
                <span className="tracking-tight">{count}</span>
              </Button>
            </HoverCardTrigger>
            <HoverCardContent
              align="center"
              className="w-auto max-w-64"
              side="top"
            >
              <div className="flex items-center gap-2">
                <span className="text-3xl">{emoji}</span>
                <p className="line-clamp-2 text-sm leading-tight">
                  {moreCount > 0
                    ? t("reacted-by-more", {
                        names: reactors.join(", "),
                        count: moreCount,
                      })
                    : t("reacted-by", { names: reactors.join(", ") })}
                </p>
              </div>
            </HoverCardContent>
          </HoverCard>
        );
      })}
    </div>
  );
}

function PostReplyIndicator({ post }: { post: ForumPost }) {
  const { parentId, replyToUser, replyToBody } = post;

  if (!(parentId && replyToUser)) {
    return null;
  }

  const scrollToParent = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(parentId)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  return (
    <a
      className="flex min-w-0 items-center gap-1 text-muted-foreground text-xs transition-colors ease-out hover:text-foreground"
      href={`#${parentId}`}
      onClick={scrollToParent}
    >
      <CornerDownRightIcon className="size-3 shrink-0" />
      <span className="max-w-32 shrink-0 truncate text-primary">
        {replyToUser.name}
      </span>
      <Activity mode={replyToBody ? "visible" : "hidden"}>
        <span className="min-w-0 flex-1 truncate">{replyToBody}</span>
      </Activity>
    </a>
  );
}

function ForumPostItemActions({ post }: { post: ForumPost }) {
  const t = useTranslations("Common");
  const setReplyTo = useForum((f) => f.setReplyTo);

  const userName = post.user?.name ?? t("anonymous");

  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const toggleReaction = useMutation(api.classes.mutations.togglePostReaction);

  const handleToggleReaction = (emoji: string) => {
    startTransition(async () => {
      await toggleReaction({ postId: post._id, emoji });
    });
  };

  return (
    <ButtonGroup
      className={cn(
        "-top-4 absolute right-4 opacity-0 shadow-xs transition-opacity ease-out group-hover:opacity-100",
        !!isOpen && "opacity-100"
      )}
    >
      <Popover onOpenChange={setIsOpen} open={isOpen}>
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger asChild>
                <Button disabled={isPending} size="icon" variant="outline">
                  <SmilePlusIcon />
                  <span className="sr-only">{t("reaction")}</span>
                </Button>
              </PopoverTrigger>
            }
          />
          <TooltipContent side="top">{t("reaction")}</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" className="w-fit p-0">
          <EmojiPicker
            className="h-80"
            onEmojiSelect={({ emoji }) => {
              handleToggleReaction(emoji);
              setIsOpen(false);
            }}
          >
            <EmojiPickerSearch />
            <EmojiPickerContent />
            <EmojiPickerFooter />
          </EmojiPicker>
        </PopoverContent>
      </Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              onClick={() => setReplyTo({ postId: post._id, userName })}
              size="icon"
              variant="outline"
            >
              <ReplyIcon />
              <span className="sr-only">{t("reply")}</span>
            </Button>
          }
        />
        <TooltipContent side="top">{t("reply")}</TooltipContent>
      </Tooltip>
    </ButtonGroup>
  );
}

function ForumPostInput({ forumId }: { forumId: Id<"schoolClassForums"> }) {
  const t = useTranslations("School.Classes");
  const replyTo = useForum((f) => f.replyTo);
  const setReplyTo = useForum((f) => f.setReplyTo);

  const textareaRef = useRef<ComponentRef<typeof InputGroupTextarea>>(null);
  const createPost = useMutation(api.classes.mutations.createForumPost);

  // Auto-focus textarea when replyTo changes
  useEffect(() => {
    if (replyTo) {
      textareaRef.current?.focus();
    }
  }, [replyTo]);

  const form = useForm({
    defaultValues: {
      body: "",
    },
    validators: {
      onChange: z.object({
        body: z.string().check(z.minLength(1), z.trim()),
      }),
    },
    onSubmit: async ({ value }) => {
      await createPost({
        forumId,
        body: value.body,
        parentId: replyTo?.postId,
      });
      form.reset();
      setReplyTo(null);
    },
  });

  return (
    <form
      className="grid shrink-0 px-2 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <ReplyIndicator />

      <form.Field name="body">
        {(field) => (
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <InputGroup className={cn(!!replyTo && "rounded-t-none")}>
                <InputGroupTextarea
                  autoFocus
                  className="scrollbar-hide max-h-36 min-h-0"
                  disabled={isSubmitting}
                  name={field.name}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      form.handleSubmit();
                    }
                  }}
                  placeholder={t("send-message-placeholder")}
                  ref={textareaRef}
                  value={field.state.value}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    disabled={isSubmitting || !field.state.value.trim()}
                    size="icon"
                    type="submit"
                    variant="default"
                  >
                    {isSubmitting ? <SpinnerIcon /> : <ArrowUpIcon />}
                    <span className="sr-only">{t("submit")}</span>
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            )}
          </form.Subscribe>
        )}
      </form.Field>
    </form>
  );
}

function ReplyIndicator() {
  const t = useTranslations("Common");
  const replyTo = useForum((f) => f.replyTo);
  const setReplyTo = useForum((f) => f.setReplyTo);

  if (!replyTo) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 overflow-hidden rounded-t-md border-x border-t bg-muted px-3 py-2 text-sm">
      <ReplyIcon className="size-4 text-muted-foreground" />
      <p className="min-w-0 flex-1 truncate text-muted-foreground">
        {t.rich("replying-to-user", {
          name: () => (
            <span className="font-medium text-primary">{replyTo.userName}</span>
          ),
        })}
      </p>
      <Button
        onClick={() => setReplyTo(null)}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <span className="sr-only">{t("cancel")}</span>
        <XIcon />
      </Button>
    </div>
  );
}

function DateSeparator({ date }: { date: number }) {
  const locale = useLocale();

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-border" />
      <time className="shrink-0 text-muted-foreground text-xs">
        {format(date, "d. MMMM yyyy", { locale: getLocale(locale) })}
      </time>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
