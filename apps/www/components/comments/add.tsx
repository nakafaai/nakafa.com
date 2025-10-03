"use client";

import { api } from "@repo/backend/convex/_generated/api";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import {
  Button,
  buttonVariants,
} from "@repo/design-system/components/ui/button";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import { Link, usePathname } from "@repo/internationalization/src/navigation";
import { useMutation, useQuery } from "convex/react";
import { LogInIcon, SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEventHandler, useTransition } from "react";
import { getInitialName } from "@/lib/utils/helper";

type Props = {
  slug: string;
};

export function AddComment({ slug }: Props) {
  const t = useTranslations("Comments");

  const user = useQuery(api.auth.getCurrentUser);
  const addComment = useMutation(api.comments.mutations.addComment);

  const [isPending, startTransition] = useTransition();

  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    const text = event.currentTarget.text.value.trim();

    if (!text) {
      return;
    }

    startTransition(() => {
      addComment({
        contentSlug: slug,
        text,
      });
    });

    // Reset the textarea
    event.currentTarget.text.value = "";
  };

  return (
    <form
      className="w-full divide-y overflow-hidden rounded-xl border bg-background shadow-sm"
      onSubmit={handleSubmit}
    >
      <Textarea
        className={cn(
          "w-full resize-none rounded-none border-none p-4 shadow-none outline-none ring-0",
          "field-sizing-content bg-transparent dark:bg-transparent",
          "max-h-48 min-h-16",
          "focus-visible:ring-0"
        )}
        name="text"
        placeholder={t("add-comment-placeholder")}
      />
      <div className="flex items-center justify-between p-1">
        <UserAvatar />
        <Button
          className="rounded-lg"
          disabled={isPending || !user}
          size="icon"
          type="submit"
        >
          {isPending ? <SpinnerIcon /> : <SendIcon />}
        </Button>
      </div>
    </form>
  );
}

function UserAvatar() {
  const pathname = usePathname();

  const t = useTranslations("Auth");

  const user = useQuery(api.auth.getCurrentUser);

  if (!user) {
    return (
      <Link
        className={cn(buttonVariants({ variant: "ghost" }), "rounded-lg")}
        href={`/auth?redirect=${pathname}`}
      >
        <LogInIcon />
        {t("login")}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-8 rounded-lg">
        <AvatarImage alt={user.name} src={user.image ?? ""} />
        <AvatarFallback className="rounded-lg">
          {getInitialName(user.name)}
        </AvatarFallback>
      </Avatar>
      <p className="text-muted-foreground text-sm">{user.name}</p>
    </div>
  );
}
