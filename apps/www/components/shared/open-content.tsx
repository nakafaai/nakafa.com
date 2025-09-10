"use client";

import {
  SiClaude,
  SiGithub,
  SiGooglegemini,
  SiOpenai,
} from "@icons-pack/react-simple-icons";
import { api } from "@repo/connection/routes";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { cn } from "@repo/design-system/lib/utils";
import { Link } from "@repo/internationalization/src/navigation";
import {
  ChevronDownIcon,
  CopyIcon,
  ExternalLinkIcon,
  MessageCircleIcon,
  SparklesIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useAi } from "@/lib/context/use-ai";
import { getGithubUrl } from "@/lib/utils/github";

export function OpenContent({ slug }: { slug: string }) {
  return (
    <div className="inline-flex divide-x divide-secondary-foreground/10 rounded-md shadow-xs rtl:space-x-reverse">
      <LLmCopyButton slug={slug} />
      <ViewOptions slug={slug} />
    </div>
  );
}

export function AskAiButton() {
  const setOpen = useAi((state) => state.setOpen);
  const t = useTranslations("Ai");

  return (
    <Button onClick={() => setOpen(true)}>
      <SparklesIcon />
      {t("ask-nina")}
    </Button>
  );
}

function LLmCopyButton({ slug }: { slug: string }) {
  const t = useTranslations("Common");
  const [isPending, startTransition] = useTransition();

  const handleCopy = () => {
    startTransition(async () => {
      const { data, error } = await api.contents.getContent({
        slug,
      });

      if (error) {
        toast.error(error.message, {
          position: "bottom-center",
        });
        return;
      }

      if (!data) {
        toast.error(t("copy-error"), {
          position: "bottom-center",
        });
        return;
      }

      navigator.clipboard
        .writeText(data.raw)
        .then(() => {
          toast.success(t("copy-success"), {
            position: "bottom-center",
          });
        })
        .catch((e) => {
          toast.error(e.message, {
            position: "bottom-center",
          });
        });
    });
  };

  return (
    <Button
      className="rounded-none shadow-none first:rounded-s-md last:rounded-e-md focus-visible:z-10"
      disabled={isPending}
      onClick={handleCopy}
      variant="secondary"
    >
      {isPending ? (
        <SpinnerIcon className="size-4" />
      ) : (
        <CopyIcon className="size-4" />
      )}
      {t("copy")}
    </Button>
  );
}

function ViewOptions({ slug }: { slug: string }) {
  const t = useTranslations("Common");

  const locale = slug.split("/")[1];
  const path = `/${slug.split("/").slice(2).join("/")}`;

  const markdownUrl = new URL(`${slug}.mdx`, "https://nakafa.com");
  const q = `I’m looking at this ${markdownUrl}, help me understand. Explain to me what is this about.`;

  const claude = `https://claude.ai/new?${new URLSearchParams({
    q,
  })}`;
  const gpt = `https://chatgpt.com/?${new URLSearchParams({
    hints: "search",
    q,
  })}`;
  const gemini = `https://gemini.google.com/app?${new URLSearchParams({
    q,
  })}`;
  const t3 = `https://t3.chat/new?${new URLSearchParams({
    q,
  })}`;

  const githubUrl = getGithubUrl({
    path: `/packages/contents${path}/${locale}.mdx`,
  });

  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger asChild>
        <Button
          className="rounded-none shadow-none first:rounded-s-md last:rounded-e-md focus-visible:z-10"
          size="icon"
          variant="secondary"
        >
          <span className="sr-only">{t("open")}</span>
          <ChevronDownIcon
            className={cn("size-4 transition-transform", open && "rotate-180")}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        {[
          {
            title: t("open-in-github"),
            href: githubUrl,
            icon: <SiGithub />,
          },
          {
            title: t("open-in-chatgpt"),
            href: gpt,
            icon: <SiOpenai />,
          },
          {
            title: t("open-in-gemini"),
            href: gemini,
            icon: <SiGooglegemini />,
          },
          {
            title: t("open-in-claude"),
            href: claude,
            icon: <SiClaude />,
          },
          {
            title: t("open-in-t3-chat"),
            href: t3,
            icon: <MessageCircleIcon />,
          },
        ].map((item) => (
          <DropdownMenuItem asChild key={item.title}>
            <Link href={item.href} target="_blank">
              {item.icon}
              {item.title}

              <ExternalLinkIcon className="ms-auto size-3.5" />
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
