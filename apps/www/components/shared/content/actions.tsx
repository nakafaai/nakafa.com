"use client";

import {
  ArrowUpRight01Icon,
  Copy01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { Effect } from "effect";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { type ReactNode, useLayoutEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import {
  readOpenContentCopySource,
  writeOpenContentCopy,
} from "@/components/shared/content/copy";

/**
 * Loads the open-in submenu when the actions menu opens. Its brand logos are
 * one module that no content page needs before that.
 */
const OpenInSubmenuContent = dynamic(
  () =>
    import("@/components/shared/content/open").then(
      (module) => module.OpenInSubmenuContent
    ),
  {
    loading: () => null,
    ssr: false,
  }
);

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
  children,
}: {
  children?: ReactNode;
  slug: string;
  content?: string | undefined;
  copySourceUrl?: null | string;
  sourceUrl?: null | string;
}) {
  const t = useTranslations("Common");
  const [open, { close, set }] = useDisclosure(false);
  const [isCopying, startTransition] = useTransition();
  const copyAbortController = useRef<AbortController | null>(null);

  useLayoutEffect(
    () => () => {
      copyAbortController.current?.abort();
      copyAbortController.current = null;
      close();
    },
    [close]
  );

  /** Copies preview source directly or loads immutable published source. */
  const handleCopy = () => {
    copyAbortController.current?.abort();
    const abortController = new AbortController();
    copyAbortController.current = abortController;

    // The clipboard write has to start inside this click, so it takes the
    // source as a promise and runs before this handler returns.
    const source = Effect.runPromise(
      readOpenContentCopySource({
        ...(content === undefined ? {} : { content }),
        ...(copySourceUrl === undefined ? {} : { copySourceUrl }),
      }),
      { signal: abortController.signal }
    );
    const copyProgram = writeOpenContentCopy(source).pipe(
      Effect.matchEffect({
        onFailure: () =>
          Effect.sync(() =>
            toast.error(t("copy-error"), { position: "bottom-center" })
          ),
        onSuccess: () =>
          Effect.sync(() => {
            toast.success(t("copy-success"), { position: "bottom-center" });
          }),
      }),
      Effect.ensuring(
        Effect.sync(() => {
          if (copyAbortController.current !== abortController) {
            return;
          }
          copyAbortController.current = null;
        })
      )
    );

    startTransition(async () => {
      await Effect.runPromiseExit(copyProgram, {
        signal: abortController.signal,
      });
    });
  };

  return (
    <DropdownMenu onOpenChange={set} open={open}>
      <Tooltip disabled={open}>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={t("more-actions")}
                  size="icon"
                  variant="outline"
                />
              }
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </DropdownMenuTrigger>
          }
        />
        <TooltipContent side="bottom">{t("more-actions")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("more")}</DropdownMenuLabel>
          {children}
          <DropdownMenuItem
            disabled={isCopying || !(content || copySourceUrl)}
            onClick={handleCopy}
          >
            <HugeIcons icon={Copy01Icon} />
            {t("copy-content")}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <HugeIcons icon={ArrowUpRight01Icon} />
              {t("open-in")}
            </DropdownMenuSubTrigger>
            <OpenInSubmenuContent slug={slug} sourceUrl={sourceUrl} />
          </DropdownMenuSub>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
