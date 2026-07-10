"use client";

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@repo/design-system/components/ui/pagination";
import { useTranslations } from "next-intl";
import type { TryoutSetPagerValue } from "@/components/tryout/catalog/table/types";

/** Renders truthful previous and next controls for Convex cursor pages. */
export function TryoutSetTablePager({ pager }: { pager: TryoutSetPagerValue }) {
  const tCommon = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");

  return (
    <footer className="shrink-0 border-t px-4 py-3">
      <Pagination>
        <PaginationContent className="w-full justify-between gap-2">
          <PaginationItem>
            <Button
              disabled={!pager.canPrevious}
              onClick={pager.previous}
              size="sm"
              type="button"
              variant="outline"
            >
              <HugeIcons data-icon="inline-start" icon={ArrowLeft01Icon} />
              {tCommon("previous")}
            </Button>
          </PaginationItem>
          <PaginationItem>
            <span className="text-muted-foreground text-sm">
              {tTryouts("set-page-label", { page: pager.index + 1 })}
            </span>
          </PaginationItem>
          <PaginationItem>
            <Button
              disabled={!pager.canNext}
              onClick={pager.next}
              size="sm"
              type="button"
              variant="outline"
            >
              {tCommon("next")}
              <HugeIcons data-icon="inline-end" icon={ArrowRight01Icon} />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </footer>
  );
}
