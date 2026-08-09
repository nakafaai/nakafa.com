"use client";

import {
  ArrowDown01Icon,
  Copy01Icon,
  LinkSquare02Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { useDisclosure, useTimeout } from "@mantine/hooks";
import {
  BrandLogo,
  type BrandLogoName,
} from "@repo/design-system/components/logos/brand";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@repo/design-system/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import { Link } from "@repo/internationalization/src/navigation";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { copyOpenContent } from "@/components/shared/open-content-copy";

/**
 * Renders open/share actions for one content page.
 *
 * Copy feedback and the dropdown are transient UI, so they reset when Next
 * hides the page through Cache Components state preservation.
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
  copySourceUrl,
  sourceUrl,
}: {
  slug: string;
  content?: string;
  copySourceUrl?: null | string;
  sourceUrl?: null | string;
}) {
  const t = useTranslations("Common");
  const [copied, setCopied] = useState(false);
  const { clear: clearCopiedTimeout, start: startCopiedTimeout } = useTimeout(
    () => setCopied(false),
    500
  );
  const [open, { close, set }] = useDisclosure(false);
  const [isCopying, setIsCopying] = useState(false);
  const copyAbortController = useRef<AbortController | null>(null);

  useLayoutEffect(
    () => () => {
      copyAbortController.current?.abort();
      copyAbortController.current = null;
      clearCopiedTimeout();
      setCopied(false);
      setIsCopying(false);
      close();
    },
    [clearCopiedTimeout, close]
  );

  /** Copies preview source directly or loads immutable published source. */
  const handleCopy = () => {
    copyAbortController.current?.abort();
    const abortController = new AbortController();
    copyAbortController.current = abortController;
    setIsCopying(true);

    const copyProgram = copyOpenContent({
      content,
      copySourceUrl,
      writeClipboard: (source) => navigator.clipboard.writeText(source),
    }).pipe(
      Effect.matchEffect({
        onFailure: () =>
          Effect.sync(() =>
            toast.error(t("copy-error"), { position: "bottom-center" })
          ),
        onSuccess: () =>
          Effect.sync(() => {
            clearCopiedTimeout();
            setCopied(true);
            startCopiedTimeout();
            toast.success(t("copy-success"), { position: "bottom-center" });
          }),
      }),
      Effect.ensuring(
        Effect.sync(() => {
          if (copyAbortController.current !== abortController) {
            return;
          }
          copyAbortController.current = null;
          setIsCopying(false);
        })
      )
    );

    Effect.runPromiseExit(copyProgram, {
      signal: abortController.signal,
    });
  };

  const markdownUrl = new URL(`${slug}.mdx`, "https://nakafa.com");
  const q = `I'm looking at this ${markdownUrl}, help me understand.`;

  const links: {
    href: string;
    logo: BrandLogoName;
    title: string;
  }[] = [];
  if (sourceUrl) {
    links.push({
      href: sourceUrl,
      logo: "github",
      title: t("open-in-github"),
    });
  }
  links.push(
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
    }
  );

  return (
    <ButtonGroup>
      <Button
        disabled={isCopying || !(content || copySourceUrl)}
        onClick={handleCopy}
        variant="secondary"
      >
        <HugeIcons icon={copied ? Tick01Icon : Copy01Icon} />
        {t("copy-content")}
      </Button>

      <ButtonGroupSeparator />

      <DropdownMenu onOpenChange={set} open={open}>
        <DropdownMenuTrigger
          render={
            <Button aria-label={t("open")} size="icon" variant="secondary" />
          }
        >
          <span className="sr-only">{t("open")}</span>
          <HugeIcons
            className={cn("transition-transform", open && "rotate-180")}
            icon={ArrowDown01Icon}
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-56">
          <DropdownMenuGroup>
            {links.map((item) => (
              <DropdownMenuItem
                key={item.title}
                render={
                  <Link
                    href={item.href}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <BrandLogo name={item.logo} />
                    {item.title}
                    <HugeIcons className="ms-auto" icon={LinkSquare02Icon} />
                  </Link>
                }
              />
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}
