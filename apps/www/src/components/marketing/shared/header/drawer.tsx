import { Menu01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerPanel,
  DrawerTitle,
  DrawerTrigger,
} from "@repo/design-system/components/ui/drawer";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import {
  HEADER_SECTIONS,
  type HeaderLink,
} from "@/components/marketing/shared/header/sections";
import { TargetLink } from "@/lib/routing/link";

/**
 * One link of the drawer, on the row a menu item draws. It is the drawer's own
 * close control drawn as the link, so a press opens the page and closes the
 * drawer in one.
 */
function HeaderDrawerLink({ link }: { link: HeaderLink }) {
  const t = useTranslations();

  return (
    <DrawerClose
      className="hover:bg-accent hover:text-accent-foreground hover:**:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground flex min-h-10 items-center gap-2 rounded-sm px-2 text-sm outline-hidden transition-colors"
      nativeButton={false}
      render={
        <TargetLink
          hash={"hash" in link ? link.hash : undefined}
          target={link.target}
        />
      }
    >
      <HugeIcons className="text-muted-foreground" icon={link.icon} />
      {t(link.label)}
    </DrawerClose>
  );
}

/**
 * The header's sections below `lg`, in a drawer that the Menu button opens and
 * that closes as an iPhone sheet does, by its handle, a swipe down or a tap
 * outside, so it draws no close button: each section under its name with its
 * groups of links, and the page's call to action, which the caller gives as
 * children, in the footer, since a phone's header has no room for it. Each
 * action leaves the marketing pages, so the drawer closes with them.
 */
export function HeaderDrawer({ children }: { children: ReactNode }) {
  const t = useTranslations();

  return (
    <Drawer showSwipeHandle>
      <DrawerTrigger
        render={
          <Button className="lg:hidden" variant="outline">
            <HugeIcons icon={Menu01Icon} />
            {t("Marketing.menu")}
          </Button>
        }
      />
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t("Marketing.menu")}</DrawerTitle>
        </DrawerHeader>
        <DrawerPanel>
          {Arr.map(HEADER_SECTIONS, (section) => (
            <section className="grid gap-2" key={section.key}>
              <h2 className="px-2 text-base font-medium">{t(section.label)}</h2>
              {Arr.map(section.groups, (group) => (
                <nav
                  aria-label={t(group.label)}
                  className="grid"
                  key={group.label}
                >
                  <p className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
                    {t(group.label)}
                  </p>
                  {Arr.map(group.links, (link) => (
                    <HeaderDrawerLink key={link.label} link={link} />
                  ))}
                </nav>
              ))}
            </section>
          ))}
        </DrawerPanel>
        <DrawerFooter>{children}</DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
