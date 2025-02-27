import { cn } from "@/lib/utils";
import type { PagefindResult } from "@/types/pagefind";
import Link from "next/link";
import { Separator } from "../ui/separator";

type Props = {
  data: PagefindResult;
};

export function SearchResults({ data }: Props) {
  return (
    <div className="space-y-2 px-2 py-3">
      <div className="px-2">
        <p className="font-medium text-muted-foreground text-sm leading-tight tracking-tight">
          {data.meta.title}
        </p>
      </div>

      <Separator />

      {data.sub_results.map((subResult) => {
        return (
          <Link key={subResult.url} href={subResult.url}>
            <div className="group rounded-md p-2 transition-colors hover:bg-primary/5">
              <p className="mb-1 font-medium leading-tight tracking-tight">
                {subResult.title}
              </p>
              <p
                className={cn(
                  "text-muted-foreground text-sm leading-snug",
                  "[&_mark]:bg-primary [&_mark]:text-primary-foreground"
                )}
                // biome-ignore lint/security/noDangerouslySetInnerHtml: we are using a markdown parser
                dangerouslySetInnerHTML={{ __html: subResult.excerpt }}
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
