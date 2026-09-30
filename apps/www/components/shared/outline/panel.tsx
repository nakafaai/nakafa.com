import { Menu02Icon } from "@hugeicons/core-free-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
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
import { OutlineContent } from "@/components/shared/outline/scroll";

/** The outline panel: its heading slot, the outline, and the page's actions. */
export type SidebarRightProps = {
  children: ReactNode;
  footer: ReactNode;
  header?: ReactNode;
} & ComponentProps<typeof Sidebar>;

/** Outline heading slot, which can resolve independently from the panel. */
export function SidebarRightHeader({
  title,
  href,
  description,
  descriptionLanguage,
}: {
  title: string;
  href: string;
  description?: string | undefined;
  descriptionLanguage?: string;
}) {
  return (
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            render={<NavigationLink href={href} title={title} />}
            size="lg"
          >
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{title}</span>
              {!!description && (
                <SidebarMenuDescription lang={descriptionLanguage}>
                  {description}
                </SidebarMenuDescription>
              )}
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
  return (
    <div className="shrink-0">
      <SidebarRightProvider>
        <SidebarTrigger
          className="fixed top-20 right-6 z-20 size-9 bg-background/80 backdrop-blur-xs xl:hidden"
          icon={Menu02Icon}
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
      className="min-w-0"
      cookieName="sidebar_state:right"
      keyboardShortcut="x"
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
  return (
    <aside>
      <Sidebar containerClassName="lg:hidden xl:block" side="right" {...props}>
        {header}
        <OutlineContent>{children}</OutlineContent>
        {footer}
      </Sidebar>
    </aside>
  );
}
