import { searchAtom } from "@/lib/jotai/search";
import type { PagefindResult } from "@/types/pagefind";
import { useSetAtom } from "jotai";
import { FileTextIcon } from "lucide-react";
import Link from "next/link";

type Props = {
  data: PagefindResult;
};

export function SearchResults({ data }: Props) {
  const setOpen = useSetAtom(searchAtom);

  return (
    <div className="space-y-2 border-b px-2 py-4 last:border-b-0">
      <div className="px-2">
        <h1 className="font-medium text-muted-foreground text-sm leading-tight tracking-tight">
          {data.meta.title}
        </h1>
      </div>

      <div className="flex flex-col gap-0.5">
        {data.sub_results.map((subResult) => {
          return (
            <Link
              key={subResult.url}
              href={subResult.url}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              prefetch
            >
              <div className="group rounded-md p-2 transition-colors hover:bg-primary/5">
                <div className="flex items-center gap-1.5">
                  <FileTextIcon className="size-4 shrink-0 opacity-80" />
                  <h2 className="line-clamp-1 font-medium leading-tight">
                    {subResult.title}
                  </h2>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
