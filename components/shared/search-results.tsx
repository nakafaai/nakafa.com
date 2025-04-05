import { searchAtom } from "@/lib/jotai/search";
import { cn } from "@/lib/utils";
import type { PagefindResult } from "@/types/pagefind";
import { useSetAtom } from "jotai";
import { FileTextIcon } from "lucide-react";
import Link from "next/link";

type Props = {
  data: PagefindResult;
};

export function SearchResults({ data }: Props) {
  const setOpen = useSetAtom(searchAtom);

  // Filter out sub_results with titles matching the meta title
  const visibleSubResults = data.sub_results.filter(
    (subResult) => subResult.title !== data.meta.title
  );

  // If there are no visible sub_results, don't render anything
  if (visibleSubResults.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 border-b px-2 py-4 last:border-b-0">
      <div className="px-2">
        <h1 className="font-medium text-muted-foreground text-sm leading-tight tracking-tight">
          {data.meta.title}
        </h1>
      </div>

      <div className="flex flex-col gap-0.5">
        {visibleSubResults.map((subResult) => (
          <Link
            key={subResult.url}
            href={subResult.url}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            prefetch
          >
            <div
              className={cn(
                "group rounded-md p-2 transition-colors hover:bg-primary/5",
                getAnchorStyle(subResult.anchor)
              )}
            >
              <div className="flex items-center gap-1.5">
                <FileTextIcon className="size-4 shrink-0 opacity-80" />
                <h2 className="line-clamp-1 font-medium leading-tight">
                  {subResult.title}
                </h2>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function getAnchorStyle(
  anchor: PagefindResult["sub_results"][number]["anchor"]
) {
  if (!anchor) {
    return null;
  }
  if (anchor.element === "h3") {
    return "ml-4";
  }
  if (anchor.element === "h4") {
    return "ml-8";
  }
  if (anchor.element === "h5") {
    return "ml-12";
  }
  if (anchor.element === "h6") {
    return "ml-16";
  }
  return null;
}
