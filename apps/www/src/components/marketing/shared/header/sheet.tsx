import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerPanel,
  DrawerTitle,
} from "@repo/design-system/components/ui/drawer";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr } from "effect";
import { createContext, type ReactNode, use } from "react";
import { useTranslations } from "use-intl";
import {
  HEADER_SECTIONS,
  type HeaderLink,
} from "@/components/marketing/shared/header/sections";
import { TargetLink } from "@/lib/routing/link";

/** Closes the header's drawer, which its links call; none outside a drawer. */
const HeaderDrawerClose = createContext<(() => void) | null>(null);

/** One link of the drawer, on the row a menu item draws. A press opens its page or part and closes the drawer, the current address included. */
function HeaderDrawerLink({ link }: { link: HeaderLink }) {
  const t = useTranslations();
  const close = use(HeaderDrawerClose);

  return (
    <TargetLink
      className="hover:bg-accent hover:text-accent-foreground hover:**:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground flex min-h-10 items-center gap-2 rounded-sm px-2 text-sm outline-hidden transition-colors"
      hash={"hash" in link ? link.hash : undefined}
      onClick={() => close?.()}
      target={link.target}
    >
      <HugeIcons className="text-muted-foreground" icon={link.icon} />
      {t(link.label)}
    </TargetLink>
  );
}

/**
 * The header's sections below `lg`, in a drawer that closes as an iPhone sheet
 * does, by its handle, a swipe down or a tap outside, so it draws no close
 * button: each section under its name with its groups of links, and the page's
 * call to action, which the caller gives as children, in the footer, since a
 * phone's header has no room for it. The Menu button outside it opens it
 * (`open`), and its links close it as they open their page. Its code
 * loads on the reader's intent, never with the page (ADR 0039).
 */
export function HeaderSheet({
  children,
  onOpenChange,
  open,
}: {
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useTranslations();

  return (
    <HeaderDrawerClose value={() => onOpenChange(false)}>
      <Drawer onOpenChange={onOpenChange} open={open}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t("Marketing.menu")}</DrawerTitle>
          </DrawerHeader>
          <DrawerPanel>
            {Arr.map(HEADER_SECTIONS, (section) => (
              <section className="grid gap-2" key={section.key}>
                <h2 className="px-2 text-base font-medium">
                  {t(section.label)}
                </h2>
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
          <DrawerFooter className="items-end">{children}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    </HeaderDrawerClose>
  );
}
