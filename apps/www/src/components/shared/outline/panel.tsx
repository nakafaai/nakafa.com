import { Menu02Icon } from "@hugeicons/core-free-icons";
import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@repo/design-system/components/ui/sidebar-content";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuDescription,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { SidebarProvider } from "@repo/design-system/components/ui/sidebar-provider";
import {
  Sidebar,
  SidebarTrigger,
} from "@repo/design-system/components/ui/sidebar-shell";
import type { ComponentProps, ReactNode } from "react";
import { useTranslations } from "use-intl";
import { PublicPathLink } from "@/lib/routing/public/link";

/** The outline panel: its heading slot, the outline, and the page's actions. */
type SidebarRightProps = {
  children: ReactNode;
  footer: ReactNode;
  header?: ReactNode;
} & Omit<ComponentProps<typeof Sidebar>, "label">;

/**
 * The outline heading: the page's title and its description, one line each, linked
 * to the page through the router. A border closes it, as the footer's border opens
 * the actions, so the panel reads as header, outline and footer.
 */
export function SidebarRightHeader({
  context,
  description,
  descriptionLanguage,
  publicPath,
  title,
}: {
  /** The curriculum hint that the link to the page carries, when the reader came from one. */
  context?: string | undefined;
  description: string;
  descriptionLanguage?: string;
  /** The signed public path of the page the header names, which the router opens. */
  publicPath: string;
  title: string;
}) {
  return (
    <SidebarHeader className="border-b">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            render={
              <PublicPathLink
                context={context}
                publicPath={publicPath}
                title={title}
              />
            }
            size="lg"
          >
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{title}</span>
              <SidebarMenuDescription lang={descriptionLanguage}>
                {description}
              </SidebarMenuDescription>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}

/** Frames the page actions composed below the outline. */
export function SidebarRightFooter({ children }: { children: ReactNode }) {
  return (
    <SidebarFooter className="border-t">
      <SidebarMenu>{children}</SidebarMenu>
    </SidebarFooter>
  );
}

/** The outline panel with its own provider and floating trigger. */
export function SidebarRight(props: SidebarRightProps) {
  const tCommon = useTranslations("Common");

  return (
    <div className="shrink-0">
      <SidebarRightProvider>
        <SidebarTrigger
          className="fixed top-20 right-6 z-20 size-9 bg-background/80 backdrop-blur-xs xl:hidden"
          icon={Menu02Icon}
          label={tCommon("on-this-page")}
          size="icon"
          variant="outline"
        />
        <SidebarRightPanel {...props} />
      </SidebarRightProvider>
    </div>
  );
}

/** Shares outline state with controls composed anywhere within the page. */
export function SidebarRightProvider({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider
      className="min-w-0 transition-[padding-right] duration-surface motion-reduce:transition-none xl:pr-64 xl:has-[[data-side=right][data-sidebar-state=collapsed]]:pr-0"
      cookieName="sidebar_state:right"
      keyboardShortcut="shift+x"
      sidebarDesktop={1279.98}
    >
      {children}
    </SidebarProvider>
  );
}

/** Renders the outline panel using the page's nearest sidebar provider. */
export function SidebarRightPanel({
  children,
  footer,
  header,
  ...props
}: SidebarRightProps) {
  const tCommon = useTranslations("Common");

  return (
    <aside>
      <Sidebar
        containerClassName="lg:hidden xl:block [&>[data-slot=sidebar-gap]]:hidden"
        label={tCommon("on-this-page")}
        side="right"
        {...props}
      >
        {header}
        <SidebarContent>{children}</SidebarContent>
        {footer}
      </Sidebar>
    </aside>
  );
}
