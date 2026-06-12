"use client";

import {
  ArrowUp02Icon,
  Cancel01Icon,
  Login01Icon,
} from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@repo/design-system/components/ui/input-group";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Link, usePathname } from "@repo/internationalization/src/navigation";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { type SubmitEventHandler, useState, useTransition } from "react";
import { useUser } from "@/lib/context/use-user";
import { getInitialName } from "@/lib/utils/helper";

interface Props {
  closeButton?: {
    onClick: () => void;
  };
  /* If comment is provided, the comment will be replied to */
  comment?: Doc<"comments">;
  slug: string;
}

/**
 * Renders the COSS-native comment composer for a content page or reply.
 *
 * The form owns only submission state and comment text. Visual control chrome
 * stays inside InputGroup so focus rings, radius, and button sizing follow the
 * design-system contract instead of a page-specific shell.
 */
export function CommentsAdd({ slug, comment, closeButton }: Props) {
  const t = useTranslations("Comments");
  const tCommon = useTranslations("Common");

  const [commentText, setCommentText] = useState("");

  const user = useUser((s) => s.user);
  const addComment = useMutation(api.comments.mutations.addComment);

  const [isPending, startTransition] = useTransition();

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
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
    <form className="w-full" onSubmit={handleSubmit}>
      <InputGroup>
        <InputGroupTextarea
          aria-label={t("add-comment-placeholder")}
          className="max-h-48"
          id="text"
          name="text"
          onChange={(e) => setCommentText(e.target.value)}
          placeholder={t("add-comment-placeholder")}
          value={commentText}
        />
        <InputGroupAddon align="block-end" className="justify-between">
          <UserAvatar />

          <div className="flex items-center gap-1">
            {!!closeButton && (
              <Button
                aria-label={tCommon("cancel")}
                onClick={closeButton.onClick}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <HugeIcons icon={Cancel01Icon} />
                <span className="sr-only">{tCommon("cancel")}</span>
              </Button>
            )}
            <Button
              aria-label={t("comment")}
              disabled={isPending || !user}
              size="icon-sm"
              type="submit"
            >
              <Spinner icon={ArrowUp02Icon} isLoading={isPending} />
              <span className="sr-only">{t("comment")}</span>
            </Button>
          </div>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}

/**
 * Renders the current commenter identity or the auth call-to-action.
 *
 * The unauthenticated path uses Button's render seam so the link keeps native
 * COSS button sizing and state styling without a local variant class shim.
 */
function UserAvatar() {
  const pathname = usePathname();

  const t = useTranslations("Auth");

  const user = useUser((s) => s.user);

  if (!user) {
    return (
      <Button
        render={<Link href={`/auth?redirect=${pathname}`} />}
        variant="ghost"
      >
        <HugeIcons icon={Login01Icon} />
        {t("login")}
      </Button>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2 px-2">
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
