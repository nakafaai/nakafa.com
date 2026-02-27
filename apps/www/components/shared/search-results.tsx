import {
  FileIcon,
  InformationCircleIcon,
  Rocket01Icon,
  Sad02Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import { Fragment, type ReactElement } from "react";
import type { PagefindResult } from "@/types/pagefind";

interface Props {
  error: string | ReactElement;
  isError: boolean;
  isLoading: boolean;
  query: string;
  results: PagefindResult[];
}

export function SearchResults({
  results,
  query,
  isLoading,
  isError,
  error,
}: Props) {
  const t = useTranslations("Utils");

  if (isError) {
    return (
      <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm">
        <HugeIcons className="size-4" icon={InformationCircleIcon} />
        <div className="mt-1">{t("search-error")}</div>
        {typeof error === "string" || typeof error === "object" ? (
          <div className="wrap-break-word mt-2 max-w-xs text-xs">{error}</div>
        ) : null}
      </div>
    );
  }

  if (!query) {
    return (
      <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm">
        <HugeIcons className="size-4" icon={Rocket01Icon} />
        <p>{t("search-help")}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm">
        <Spinner className="size-4" />
        <p>{t("search-loading")}</p>
      </div>
    );
  }

  if (results.length === 0 && query) {
    return (
      <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm">
        <HugeIcons className="size-4" icon={Sad02Icon} />
        <p>{t("search-not-found")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border py-4 shadow-sm">
      {results.map((result, index) => (
        <Fragment key={result.url}>
          <div className="space-y-2">
            <h2 className="px-4 font-medium text-muted-foreground text-sm">
              {result.meta.title}
            </h2>
            <div className="flex flex-col gap-1">
              {result.sub_results.map((subResult, index) => (
                <NavigationLink
                  className={cn(
                    "group flex flex-col gap-2 p-2 px-4 text-sm transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
                  )}
                  href={subResult.url}
                  key={`${subResult.url}-${subResult.title}-${index}`}
                  title={subResult.title}
                >
                  <div className="flex items-center gap-2">
                    <HugeIcons
                      className="size-4 shrink-0 text-muted-foreground group-hover:text-accent-foreground"
                      icon={FileIcon}
                    />
                    <span className="line-clamp-1">{subResult.title}</span>
                  </div>
                  <p
                    className="line-clamp-3 text-muted-foreground text-sm group-hover:text-accent-foreground group-data-[selected=true]:text-accent-foreground"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: It's fine
                    dangerouslySetInnerHTML={{ __html: subResult.excerpt }}
                  />
                </NavigationLink>
              ))}
            </div>
          </div>
          {index !== results.length - 1 && <Separator />}
        </Fragment>
      ))}
    </div>
  );
}
