"use client";

import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import type { MaterialList } from "@/types/subjects";
import { ArrowDownIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Collapsible, CollapsibleContent } from "../ui/collapsible";

type Props = {
  material: MaterialList;
};

export function CardMaterial({ material }: Props) {
  const [isOpen, setIsOpen] = useState<boolean>(true);

  return (
    <Card className="pb-0">
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="font-medium">{material.title}</CardTitle>
          {material.description && (
            <CardDescription className="line-clamp-1">
              {material.description}
            </CardDescription>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close content" : "Open content"}
          className="shrink-0"
        >
          <ChevronDownIcon
            className={cn(
              "size-4 transition-transform",
              isOpen ? "" : "rotate-180"
            )}
          />
        </Button>
      </CardHeader>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleContent>
          <CardContent className="px-0">
            {material.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex w-full items-center gap-2 border-t px-6 py-3 transition-colors last:rounded-b-xl last:pb-6 hover:bg-accent"
              >
                <span title={item.title} className="truncate">
                  {item.title}
                </span>
                <ArrowDownIcon className="-rotate-90 size-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
