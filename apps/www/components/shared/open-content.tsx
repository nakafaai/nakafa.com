"use client";

import {
  ArrowDown01Icon,
  Copy01Icon,
  LinkSquare02Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { useClipboard, useDisclosure } from "@mantine/hooks";
import {
  BrandLogo,
  type BrandLogoName,
} from "@repo/design-system/components/logos/brand";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import { Link } from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import { useLayoutEffect } from "react";
import { toast } from "sonner";
import { getGithubUrl } from "@/lib/utils/github";

/**
 * Renders open/share actions for one content page.
 *
 * The dropdown is transient UI, so it resets closed when Next hides the page
 * through Cache Components state preservation.
 *
 * References:
 * - Next.js preserving UI state with Cache Components:
 *   `apps/www/node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`
 * - Mantine `useDisclosure`:
 *   https://mantine.dev/hooks/use-disclosure/
 */
export function OpenContent({
  slug,
  content,
}: {
  slug: string;
  content?: string;
}) {
  const t = useTranslations("Common");
  const clipboard = useClipboard({ timeout: 500 });
  const [open, { close, set }] = useDisclosure(false);

  useLayoutEffect(() => close, [close]);

  const handleCopy = () => {
    if (!content) {
      toast.error(t("copy-error"), { position: "bottom-center" });
      return;
    }
    clipboard.copy(content);
    toast.success(t("copy-success"), { position: "bottom-center" });
  };

  const locale = slug.split("/")[1];
  const path = `/${slug.split("/").slice(2).join("/")}`;
  const markdownUrl = new URL(`${slug}.mdx`, "https://nakafa.com");
  const q = `I'm looking at this ${markdownUrl}, help me understand.`;

  const githubUrl = getGithubUrl({
    path: `/packages/contents${path}/${locale}.mdx`,
  });

  const links = [
    {
      title: t("open-in-github"),
      href: githubUrl,
      logo: "github",
    },
    {
      title: t("open-in-chatgpt"),
      href: `https://chatgpt.com/?${new URLSearchParams({ hints: "search", q })}`,
      logo: "openai",
    },
    {
      title: t("open-in-gemini"),
      href: `https://gemini.google.com/app?${new URLSearchParams({ q })}`,
      logo: "gemini",
    },
    {
      title: t("open-in-claude"),
      href: `https://claude.ai/new?${new URLSearchParams({ q })}`,
      logo: "claude",
    },
  ] as const satisfies readonly {
    href: string;
    logo: BrandLogoName;
    title: string;
  }[];

  return (
    <div className="inline-flex divide-x divide-secondary-foreground/20 rounded-md shadow-xs rtl:space-x-reverse">
      <Button
        className="rounded-none shadow-none first:rounded-s-md last:rounded-e-md focus-visible:z-10"
        disabled={!content}
        onClick={handleCopy}
        variant="secondary"
      >
        <HugeIcons icon={clipboard.copied ? Tick01Icon : Copy01Icon} />
        {t("copy-content")}
      </Button>

      <DropdownMenu onOpenChange={set} open={open}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t("open")}
            className="rounded-none shadow-none first:rounded-s-md last:rounded-e-md focus-visible:z-10"
            size="icon"
            variant="secondary"
          >
            <span className="sr-only">{t("open")}</span>
            <HugeIcons
              className={cn(
                "size-4 transition-transform",
                open && "rotate-180"
              )}
              icon={ArrowDown01Icon}
            />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-56">
          {links.map((item) => (
            <DropdownMenuItem
              asChild
              className="cursor-pointer"
              key={item.title}
            >
              <Link href={item.href} rel="noopener noreferrer" target="_blank">
                <BrandLogo name={item.logo} />
                {item.title}
                <HugeIcons
                  className="ms-auto size-3.5"
                  icon={LinkSquare02Icon}
                />
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
