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

interface Props {
  material: MaterialList[number];
}

export function CardMaterial({ material }: Props) {
  const [isOpen, setIsOpen] = useState<boolean>(true);

  const id = slugify(material.title);

  return (
    <Card className="overflow-hidden pb-0">
      <CardHeader className="gap-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex w-full flex-col gap-1.5">
            <CardTitle className="group flex items-center font-medium">
              <h2
                className="inline-block scroll-mt-28"
                id={id}
                title={material.title}
              >
                {material.title}
              </h2>
              <a
                aria-label={`Link to ${material.title}`}
                className="ml-3 hidden shrink-0 text-muted-foreground group-hover:inline-block"
                href={`#${id}`}
                title={material.title}
              >
                <LinkIcon className="size-4" />
              </a>
            </CardTitle>
            {!!material.description && (
              <CardDescription title={material.description}>
                {material.description}
              </CardDescription>
            )}
          </div>
          <Button
            aria-label={isOpen ? "Close content" : "Open content"}
            className="group shrink-0"
            onClick={() => setIsOpen(!isOpen)}
            size="icon"
            variant="ghost"
          >
            <span className="sr-only">
              {isOpen ? "Close content" : "Open content"}
            </span>
            <ChevronDownIcon
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                isOpen ? "" : "rotate-180"
              )}
            />
          </Button>
        </div>
      </CardHeader>
      <Collapsible onOpenChange={setIsOpen} open={isOpen}>
        <CollapsibleContent>
          <CardContent className="divide-y border-t px-0">
            {material.items.map((item) => (
              <Link
                className="group flex w-full scroll-mt-28 items-center gap-2 px-6 py-3 transition-colors ease-out last:pb-6 hover:bg-accent hover:text-accent-foreground"
                href={item.href}
                key={item.href}
                prefetch
                title={item.title}
              >
                <h3>{item.title}</h3>
                <ArrowDownIcon className="size-4 shrink-0 -rotate-90 opacity-0 transition-opacity ease-out group-hover:opacity-100" />
              </Link>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
