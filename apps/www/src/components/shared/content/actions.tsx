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
import { lazyComponent } from "@repo/design-system/lib/lazy";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect } from "effect";
import { type ReactNode, useLayoutEffect, useRef, useTransition } from "react";
import { useTranslations } from "use-intl";
import {
  readOpenContentCopySource,
  writeOpenContentCopy,
} from "@/components/shared/content/copy";
import { OpenTargetContext } from "@/components/shared/content/target";

/**
 * Loads the open-in submenu when the actions menu opens. Its brand logos are
 * one module that no content page needs before that.
 */
const OpenInSubmenuContent = lazyComponent(
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
 * - The framework's guide to preserving UI state with cached components.
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
            toast.error(
              { title: "copy-error.title" },
              { position: "bottom-center" }
            )
          ),
        onSuccess: () =>
          Effect.sync(() => {
            toast.success(
              { title: "copy-success.title" },
              { position: "bottom-center" }
            );
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
            <OpenTargetContext value={{ slug, sourceUrl }}>
              <OpenInSubmenuContent />
            </OpenTargetContext>
          </DropdownMenuSub>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
