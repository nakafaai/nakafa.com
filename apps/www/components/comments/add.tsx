"use client";

import {
  ArrowUp02Icon,
  Cancel01Icon,
  Login01Icon,
} from "@hugeicons/core-free-icons";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Link } from "@repo/internationalization/src/navigation";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { type SubmitEventHandler, useState, useTransition } from "react";
import { useCurrentAuthNavigation } from "@/lib/auth/location.client";
import { useViewer } from "@/lib/identity/client";
import { getInitialName } from "@/lib/identity/initials";

interface Props {
  closeButton?: {
    onClick: () => void;
  };
  onSubmit: (text: string) => Promise<boolean>;
}

/** Render the authenticated comment or reply composer for one content route. */
export function CommentsAdd({ onSubmit, closeButton }: Props) {
  const t = useTranslations("Comments");
  const tCommon = useTranslations("Common");

  const [commentText, setCommentText] = useState("");

  const user = useViewer((s) => s.account);

  const [isPending, startTransition] = useTransition();

  /** Submit the trimmed comment while restoring its text after a failure. */
  const handleSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    const text = commentText.trim();
    if (!(text && user) || isPending) {
      return;
    }
    setCommentText("");
    startTransition(async () => {
      const saved = await onSubmit(text);
      if (saved) {
        closeButton?.onClick();
      } else {
        setCommentText((previous) => previous || text);
      }
    });
  };

  return (
    <form
      className="w-full divide-y overflow-hidden rounded-xl border border-input bg-background shadow-xs outline-none transition-[color,box-shadow] has-[[data-slot=textarea]:focus-visible]:border-ring has-[[data-slot=textarea]:focus-visible]:ring-3 has-[[data-slot=textarea]:focus-visible]:ring-ring/50"
      onSubmit={handleSubmit}
    >
      <Textarea
        aria-label={t("add-comment-placeholder")}
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
              aria-label={tCommon("cancel")}
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
            aria-label={t("comment")}
            className="rounded-lg"
            disabled={isPending || !user}
            size="icon"
            type="submit"
          >
            <HugeIcons icon={ArrowUp02Icon} />
            <span className="sr-only">{t("comment")}</span>
          </Button>
        </div>
      </div>
    </form>
  );
}

/** Render the current commenter identity or an authentication link. */
function UserAvatar() {
  const authNavigation = useCurrentAuthNavigation();
  const t = useTranslations("Auth");

  const user = useViewer((s) => s.account);

  if (!user) {
    return (
      <Link
        className={cn(buttonVariants({ variant: "ghost" }), "rounded-lg")}
        {...authNavigation.linkProps}
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
      <Avatar className="size-8">
        <AvatarImage alt={user.authUser.name} src={user.authUser.image ?? ""} />
        <AvatarFallback className="text-xs">
          {getInitialName(user.authUser.name)}
        </AvatarFallback>
      </Avatar>
      <p className="max-w-36 truncate text-muted-foreground text-sm">
        {user.authUser.name}
      </p>
    </div>
  );
}
