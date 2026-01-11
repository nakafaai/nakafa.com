"use client";

import {
  ArrowUp02Icon,
  Cancel01Icon,
  Login01Icon,
} from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import {
  Button,
  buttonVariants,
} from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import { Link, usePathname } from "@repo/internationalization/src/navigation";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { type FormEventHandler, useState, useTransition } from "react";
import { useUser } from "@/lib/context/use-user";
import { getInitialName } from "@/lib/utils/helper";

interface Props {
  slug: string;
  /* If comment is provided, the comment will be replied to */
  comment?: Doc<"comments">;
  closeButton?: {
    onClick: () => void;
  };
}

export function CommentsAdd({ slug, comment, closeButton }: Props) {
  const t = useTranslations("Comments");
  const tCommon = useTranslations("Common");

  const [commentText, setCommentText] = useState("");

  const user = useUser((s) => s.user);
  const addComment = useMutation(api.comments.mutations.addComment);

  const [isPending, startTransition] = useTransition();

  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    const text = event.currentTarget?.text?.value?.trim();

    if (!text) {
      return;
    }

    startTransition(async () => {
      await addComment({
        slug,
        text,
        parentId: comment?._id,
      });

      setCommentText("");

      if (closeButton) {
        closeButton.onClick();
      }
    });
  };

  return (
    <form
      className="w-full divide-y overflow-hidden rounded-xl border bg-background shadow-xs"
      onSubmit={handleSubmit}
    >
      <Textarea
        className={cn(
          "w-full resize-none rounded-none border-none p-4 shadow-none outline-none ring-0",
          "field-sizing-content bg-transparent dark:bg-transparent",
          "max-h-48 min-h-16",
          "focus-visible:ring-0"
        )}
        id="text"
        name="text"
        onChange={(e) => setCommentText(e.target.value)}
        placeholder={t("add-comment-placeholder")}
        value={commentText}
      />
      <div className="flex items-center justify-between gap-4 p-2">
        <UserAvatar />

        <div className="flex items-center gap-1">
          {!!closeButton && (
            <Button
              className="rounded-lg"
              onClick={closeButton.onClick}
              size="icon"
              type="button"
              variant="secondary"
            >
              <HugeIcons icon={Cancel01Icon} />
              <span className="sr-only">{tCommon("cancel")}</span>
            </Button>
          )}
          <Button
            className="rounded-lg"
            disabled={isPending || !user}
            size="icon"
            type="submit"
          >
            <Spinner icon={ArrowUp02Icon} isLoading={isPending} />
            <span className="sr-only">{t("comment")}</span>
          </Button>
        </div>
      </div>
    </form>
  );
}

function UserAvatar() {
  const pathname = usePathname();

  const t = useTranslations("Auth");

  const user = useUser((s) => s.user);

  if (!user) {
    return (
      <Link
        className={cn(buttonVariants({ variant: "ghost" }), "rounded-lg")}
        href={`/auth?redirect=${pathname}`}
      >
        <HugeIcons icon={Login01Icon} />
        {t("login")}
      </Link>
    );
  }

  return (
    <div
      className="flex min-w-0 items-center gap-2 px-2"
      title={user.authUser.name}
    >
      <Avatar className="size-8 rounded-lg">
        <AvatarImage
          alt={user.authUser.name}
          role="presentation"
          src={user.authUser.image ?? ""}
        />
        <AvatarFallback className="rounded-lg text-xs">
          {getInitialName(user.authUser.name)}
        </AvatarFallback>
      </Avatar>
      <p className="max-w-36 truncate text-muted-foreground text-sm">
        {user.authUser.name}
      </p>
    </div>
  );
}
