import { Menu02Icon } from "@hugeicons/core-free-icons";
import type { Reference } from "@repo/contents/content";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
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
import { CommentsButton } from "@/components/sidebar/actions/comments";
import { GithubButton } from "@/components/sidebar/actions/github";
import { ReferenceButton } from "@/components/sidebar/actions/reference";
import { ReportButton } from "@/components/sidebar/actions/report";
import { ShareButton } from "@/components/sidebar/actions/share";

export type SidebarRightProps = {
  children: ReactNode;
  header?: ReactNode;
  githubUrl?: string | undefined;
  showComments?: boolean | undefined;
  references?:
    | {
        title: string;
        data: Reference[];
      }
    | undefined;
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

function SidebarRightFooter({
  references,
  githubUrl,
  showComments = false,
}: Pick<SidebarRightProps, "references" | "githubUrl" | "showComments">) {
  return (
    <SidebarFooter className="border-t">
      <SidebarMenu>
        {!!showComments && <CommentsButton />}
        {!!references && (
          <ReferenceButton
            references={references.data}
            title={references.title}
          />
        )}
        <ReportButton />
        {!!githubUrl && <GithubButton githubUrl={githubUrl} />}
        <ShareButton />
      </SidebarMenu>
    </SidebarFooter>
  );
}

export function SidebarRight({
  children,
  header,
  references,
  githubUrl,
  showComments,
  ...props
}: SidebarRightProps) {
  return (
    <div className="shrink-0">
      <SidebarRightProvider>
        <SidebarTrigger
          className="fixed top-20 right-6 z-20 size-9 bg-background/80 backdrop-blur-xs xl:hidden"
          icon={Menu02Icon}
          size="icon"
          variant="outline"
        />
        <SidebarRightPanel
          githubUrl={githubUrl}
          header={header}
          references={references}
          showComments={showComments}
          {...props}
        >
          {children}
        </SidebarRightPanel>
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
  header,
  references,
  githubUrl,
  showComments,
  ...props
}: SidebarRightProps) {
  return (
    <aside>
      <Sidebar containerClassName="lg:hidden xl:block" side="right" {...props}>
        {header}
        <SidebarContent>{children}</SidebarContent>
        <SidebarRightFooter
          githubUrl={githubUrl}
          references={references}
          showComments={showComments}
        />
      </Sidebar>
    </aside>
  );
}
