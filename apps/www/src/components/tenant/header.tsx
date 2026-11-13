import { Add01Icon } from "@hugeicons/core-free-icons";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@repo/design-system/components/ui/breadcrumb";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { BreadcrumbAnchor } from "@/components/shared/breadcrumb/anchor";
import {
  type BreadcrumbHeaderItem,
  BreadcrumbHeaderPath,
} from "@/components/shared/breadcrumb/header";
import { PageActions, PageHeader } from "@/components/shared/page/header";
import { useTenant } from "@/components/tenant/context";
import { schoolHomeTarget } from "@/lib/routing/school/target";

/**
 * The one header of a school page (`PageHeader`): the page's path from the school's home, the page itself last, and
 * the page's actions at its end, the page's end-goal action among them. A page whose title is the path's last item
 * passes its title, which only assistive technology reads, because the path already shows it; a page whose body draws
 * its own heading, such as the not-found page, passes no title. On a phone the path folds into one menu beside the
 * page's name, so the page's actions have their room.
 */
export function SchoolHeader({
  children,
  items,
  title,
}: {
  /** The page's actions, at the end of the row. */
  children?: ReactNode;
  /** The path after the school's home, the page itself last; empty on the school's home. */
  items: readonly BreadcrumbHeaderItem[];
  /** The page's heading, unless the page's body draws its own. */
  title?: string;
}) {
  return (
    <PageHeader {...(title === undefined ? {} : { title })}>
      {/* Text at twice its size leaves the path no room, so it steps aside and takes the row's gap with it. */}
      <div className="min-w-0 @max-3xs/header:hidden">
        <SchoolPath
          items={Arr.map(items, (item, index) =>
            index === items.length - 1 ? { ...item, target: undefined } : item
          )}
        />
      </div>
      {children === undefined ? null : <PageActions>{children}</PageActions>}
    </PageHeader>
  );
}

/**
 * The action of a school page's header that adds a record, under its name. On a phone it keeps a plus, so the page's
 * path stays readable beside it, and its name stays for assistive technology and in its tooltip, which every button
 * that may show only an icon carries.
 */
export function SchoolHeaderAdd({
  label,
  onClick,
}: {
  /** The action's name, such as Add period. */
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            className="@sm/header:has-[>svg]:px-4"
            onClick={onClick}
            type="button"
          />
        }
      >
        <HugeIcons
          aria-hidden="true"
          className="@sm/header:hidden"
          icon={Add01Icon}
        />
        <span className="@max-sm/header:sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The path of a school page after its home, with the page itself last, as the current page without a
 * target. On the school's home the path is home alone, as the current page.
 */
export function SchoolPath({
  items,
}: {
  /** The path after the school's home, the page itself last with no target; empty on the school's home. */
  items: readonly BreadcrumbHeaderItem[];
}) {
  const { slug } = useTenant();
  const tCommon = useTranslations("Common");

  if (Arr.isReadonlyArrayEmpty(items)) {
    return (
      <Breadcrumb aria-label={tCommon("breadcrumb")} className="min-w-0">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              aria-current="page"
              className="text-foreground"
              render={
                <BreadcrumbAnchor target={schoolHomeTarget(slug)}>
                  {tCommon("home")}
                </BreadcrumbAnchor>
              }
            />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }
  return (
    <BreadcrumbHeaderPath
      home={schoolHomeTarget(slug)}
      homeLabel={tCommon("home")}
      items={items}
    />
  );
}
