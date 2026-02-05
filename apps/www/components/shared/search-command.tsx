"use client";

import {
  ArrowDown02Icon,
  ArrowMoveDownLeftIcon,
  ArrowUp02Icon,
  FileIcon,
  InformationCircleIcon,
  Sad02Icon,
} from "@hugeicons/core-free-icons";
import { useDebouncedValue, useHotkeys } from "@mantine/hooks";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@repo/design-system/components/ui/command";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "@repo/design-system/lib/utils";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import { Fragment, useEffect, useTransition } from "react";
import { articlesMenu } from "@/components/sidebar/_data/articles";
import { holyMenu } from "@/components/sidebar/_data/holy";
import { subjectMenu } from "@/components/sidebar/_data/subject";
import { getErrorMessage, usePagefind } from "@/lib/context/use-pagefind";
import { useSearch } from "@/lib/context/use-search";
import { useSearchQuery } from "@/lib/react-query/use-search";
import type { PagefindResult } from "@/types/pagefind";

const DEBOUNCE_TIME = 500;

export function SearchCommand() {
  const { open, setOpen } = useSearch((state) => ({
    open: state.open,
    setOpen: state.setOpen,
  }));

  useHotkeys([
    ["/", () => setOpen(true)],
    ["mod+K", () => setOpen(true)],
  ]);

  return (
    <CommandDialog
      commandProps={{
        shouldFilter: false, // filter by pagefind results
        loop: true,
      }}
      onOpenChange={setOpen}
      open={open}
    >
      <SearchMain />
      <Footer />
    </CommandDialog>
  );
}

function SearchMain() {
  return (
    <>
      <SearchInput />
      <SearchList />
    </>
  );
}

function SearchInput() {
  const t = useTranslations("Utils");

  const setQuery = useSearch((state) => state.setQuery);
  const query = useSearch((state) => state.query);

  return (
    <CommandInput
      autoFocus
      onValueChange={setQuery}
      placeholder={t("search-placeholder")}
      value={query}
    />
  );
}

function SearchList() {
  const query = useSearch((state) => state.query);
  const pagefindError = usePagefind((context) => context.error);

  const [debouncedSearch] = useDebouncedValue(query, DEBOUNCE_TIME);

  const {
    data: results = [],
    isError,
    error,
    isLoading,
    isPlaceholderData,
  } = useSearchQuery({
    query: debouncedSearch,
    enabled: Boolean(debouncedSearch),
  });

  // Combine initialization error with query error
  const hasError = isError || Boolean(pagefindError);
  const displayError = pagefindError || (error ? getErrorMessage(error) : "");

  return (
    <CommandList className="h-75 max-h-none md:h-112.5">
      <SearchListItems
        error={hasError ? displayError : ""}
        isLoading={!!isLoading && !hasError && !isPlaceholderData}
        results={results}
        search={debouncedSearch}
      />
    </CommandList>
  );
}

function SearchListItems({
  error,
  search,
  isLoading,
  results,
}: {
  error: ReactElement | string;
  search: string;
  isLoading: boolean;
  results: PagefindResult[];
}) {
  const t = useTranslations("Utils");
  const setOpen = useSearch((state) => state.setOpen);
  const [isPending, startTransition] = useTransition();

  if (error) {
    return (
      <CommandEmpty className="flex flex-col items-center justify-center gap-1 p-7.5 text-center text-muted-foreground text-sm">
        <HugeIcons className="size-4" icon={InformationCircleIcon} />
        <div className="mt-1">{t("search-error")}</div>
        {typeof error === "string" || typeof error === "object" ? (
          <div className="wrap-break-word mt-2 max-w-xs text-xs">{error}</div>
        ) : null}
      </CommandEmpty>
    );
  }

  if (!search) {
    return <DefaultItems />;
  }

  if (isLoading) {
    return (
      <CommandEmpty className="flex items-center justify-center gap-1 p-7.5 text-muted-foreground text-sm">
        <Spinner className="size-4" />
        <p>{t("search-loading")}</p>
      </CommandEmpty>
    );
  }

  if (results.length === 0 && search) {
    return (
      <CommandEmpty className="flex items-center justify-center gap-1 p-7.5 text-muted-foreground text-sm">
        <HugeIcons className="size-4" icon={Sad02Icon} />
        <p>{t("search-not-found")}</p>
      </CommandEmpty>
    );
  }

  return results.map((result, index) => (
    <Fragment key={result.url}>
      <CommandGroup heading={result.meta.title}>
        {result.sub_results.map((subResult, index) => (
          <CommandItem
            className="group cursor-pointer flex-col items-start"
            disabled={isPending}
            key={`${subResult.url}-${subResult.title}-${index}`}
            onSelect={() => {
              startTransition(() => {
                setOpen(false);
                window.location.href = subResult.url;
              });
            }}
            value={`${result.meta.title} ${subResult.title} ${subResult.url}`}
          >
            <div className="flex items-center gap-2">
              <HugeIcons icon={FileIcon} />
              <span className="line-clamp-1">{subResult.title}</span>
            </div>
            <p
              className="line-clamp-3 text-muted-foreground text-xs group-data-[selected=true]:text-accent-foreground"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: It's fine
              dangerouslySetInnerHTML={{ __html: subResult.excerpt }}
            />
          </CommandItem>
        ))}
      </CommandGroup>
      {results.length > 1 && index !== results.length - 1 && (
        <CommandSeparator alwaysRender className="my-2" />
      )}
    </Fragment>
  ));
}

function DefaultItems() {
  const t = useTranslations("Subject");
  const tArticles = useTranslations("Articles");
  const tHoly = useTranslations("Holy");

  const router = useRouter();
  const setOpen = useSearch((state) => state.setOpen);

  const [, startTransition] = useTransition();

  useEffect(() => {
    // prefetch all the links
    for (const item of subjectMenu) {
      for (const subItem of item.items) {
        router.prefetch(subItem.href);
      }
    }

    for (const item of articlesMenu) {
      router.prefetch(item.href);
    }

    for (const item of holyMenu) {
      router.prefetch(item.href);
    }
  });

  return (
    <>
      {subjectMenu.map((item) => (
        <CommandGroup heading={t(item.title)} key={item.title}>
          {item.items.map((subItem) => {
            let title = "";
            // Only grade that has value
            if ("value" in subItem) {
              title = t(subItem.title, { grade: subItem.value });
            } else {
              title = t(subItem.title);
            }

            return (
              <CommandItem
                className="cursor-pointer"
                key={title}
                onSelect={() => {
                  startTransition(() => {
                    setOpen(false);
                    router.push(subItem.href);
                  });
                }}
                value={title}
              >
                <HugeIcons icon={item.icon} />
                <span className="line-clamp-1">{title}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      ))}

      <CommandSeparator alwaysRender className="my-2" />

      <CommandGroup heading={tArticles("articles")}>
        {articlesMenu.map((item) => (
          <CommandItem
            className="cursor-pointer"
            key={item.title}
            onSelect={() => {
              startTransition(() => {
                setOpen(false);
                router.push(item.href);
              });
            }}
            value={tArticles(item.title)}
          >
            <HugeIcons icon={item.icon} />
            <span className="line-clamp-1">{tArticles(item.title)}</span>
          </CommandItem>
        ))}
      </CommandGroup>

      <CommandSeparator alwaysRender className="my-2" />

      <CommandGroup heading={tHoly("holy")}>
        {holyMenu.map((item) => (
          <CommandItem
            className="cursor-pointer"
            key={item.title}
            onSelect={() => {
              startTransition(() => {
                setOpen(false);
                router.push(item.href);
              });
            }}
            value={tHoly(item.title)}
          >
            <HugeIcons icon={item.icon} />
            <span className="line-clamp-1">{tHoly(item.title)}</span>
          </CommandItem>
        ))}
      </CommandGroup>
    </>
  );
}

function Footer() {
  const t = useTranslations("Common");

  return (
    <div className="flex items-center justify-between border-t p-3 text-muted-foreground text-sm">
      <div className="flex items-center gap-1">
        <FooterKbd>
          <HugeIcons
            className="size-3 text-muted-foreground"
            icon={ArrowMoveDownLeftIcon}
          />
        </FooterKbd>
        <span>{t("select")}</span>
      </div>
      <div className="flex items-center gap-1">
        <FooterKbd>
          <HugeIcons
            className="size-3 text-muted-foreground"
            icon={ArrowUp02Icon}
          />
        </FooterKbd>
        <FooterKbd>
          <HugeIcons
            className="size-3 text-muted-foreground"
            icon={ArrowDown02Icon}
          />
        </FooterKbd>
        <span>{t("navigate")}</span>
      </div>
      <div className="flex items-center gap-1">
        <FooterKbd className="w-auto px-1">esc</FooterKbd>
        <span>{t("close")}</span>
      </div>
    </div>
  );
}

function FooterKbd({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "pointer-events-none flex size-5 select-none items-center justify-center rounded border bg-muted text-xs",
        className
      )}
    >
      {children}
    </kbd>
  );
}
