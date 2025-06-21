"use client";

import type { MaterialList } from "@repo/contents/_types/subject/material";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
} from "@repo/design-system/components/ui/collapsible";
import { cn, slugify } from "@repo/design-system/lib/utils";
import { Link } from "@repo/internationalization/src/navigation";
import { ArrowDownIcon, ChevronDownIcon, LinkIcon } from "lucide-react";
import { useState } from "react";

type Props = {
  material: MaterialList[number];
};

export function CardMaterial({ material }: Props) {
  const [isOpen, setIsOpen] = useState<boolean>(true);

  const id = slugify(material.title);

  return (
    <Card className="pb-0">
      <CardHeader className="gap-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="group flex items-center font-medium">
              <h2
                id={id}
                title={material.title}
                className="inline-block scroll-mt-28"
              >
                {material.title}
              </h2>
              <a
                href={`#${id}`}
                title={material.title}
                className="ml-2 hidden shrink-0 text-muted-foreground group-hover:inline-block"
                aria-label={`Link to ${material.title}`}
              >
                <LinkIcon className="size-4" />
              </a>
            </CardTitle>
            {material.description && (
              <CardDescription title={material.description}>
                {material.description}
              </CardDescription>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? "Close content" : "Open content"}
            className="group shrink-0"
          >
            <span className="sr-only">
              {isOpen ? "Close content" : "Open content"}
            </span>
            <ChevronDownIcon
              className={cn(
                "size-4 text-muted-foreground transition-all group-hover:text-foreground",
                isOpen ? "" : "rotate-180"
              )}
            />
          </Button>
        </div>
      </CardHeader>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent>
          <CardContent className="px-0">
            {material.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                title={item.title}
                prefetch
                className="group flex w-full scroll-mt-28 items-center gap-2 border-t px-6 py-3 transition-colors last:rounded-b-xl last:pb-6 hover:bg-accent/20"
              >
                <h3 title={item.title} className="truncate">
                  {item.title}
                </h3>
                <ArrowDownIcon className="-rotate-90 size-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
