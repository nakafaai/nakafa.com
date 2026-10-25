"use client";

import { ArrowDown01Icon, Link04Icon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import type { MaterialList } from "@repo/contents/curriculum/list";
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
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { toAnchorSlug } from "@repo/utilities/slug";
import { cn } from "cn";
import { Array as Arr } from "effect";
import { CardLinks, PublicPathCardLink } from "@/components/shared/card/link";

interface Props {
  material: MaterialList[number];
}

/**
 * Renders one expandable material card on the material lesson index page.
 *
 * The card defaults to open, and a visit to the page starts it open again: the
 * route unmounts the card on navigation, so the material list never keeps a
 * collapsed state across route transitions.
 */
export function CardMaterial({ material }: Props) {
  const [isOpen, { set, toggle }] = useDisclosure(true);

  const id = toAnchorSlug(material.title);

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
                <HugeIcons className="size-4" icon={Link04Icon} />
              </a>
            </CardTitle>
            <CardDescription title={material.description}>
              {material.description}
            </CardDescription>
          </div>
          <Button
            aria-label={isOpen ? "Close content" : "Open content"}
            className="group shrink-0"
            onClick={toggle}
            size="icon"
            variant="ghost"
          >
            <span className="sr-only">
              {isOpen ? "Close content" : "Open content"}
            </span>
            <HugeIcons
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                isOpen ? "" : "rotate-180"
              )}
              icon={ArrowDown01Icon}
            />
          </Button>
        </div>
      </CardHeader>
      <Collapsible onOpenChange={set} open={isOpen}>
        <CollapsibleContent>
          <CardContent className="border-t px-0">
            <CardLinks>
              {Arr.map(material.items, (item) => (
                <PublicPathCardLink
                  context={item.link.context}
                  key={item.link.publicPath}
                  publicPath={item.link.publicPath}
                  title={item.title}
                >
                  <h3 className="flex-1">{item.title}</h3>
                </PublicPathCardLink>
              ))}
            </CardLinks>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
