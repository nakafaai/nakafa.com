import { Menu02Icon } from "@hugeicons/core-free-icons";
import type { Reference } from "@repo/contents/_types/content";
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
import { CommentsButton } from "@/components/sidebar/comments-button";
import { GithubButton } from "@/components/sidebar/github-button";
import { ReferenceButton } from "@/components/sidebar/reference-button";
import { ReportButton } from "@/components/sidebar/report-button";
import { ShareButton } from "@/components/sidebar/share-button";

export type SidebarRightProps = {
  children: ReactNode;
  header?: {
    title: string;
    href: string;
    description?: string;
    descriptionLanguage?: string;
  };
  githubUrl?: string;
  showComments?: boolean;
  references?: {
    title: string;
    data: Reference[];
  };
} & ComponentProps<typeof Sidebar>;

function SidebarRightHeader({
  header,
}: {
  header: SidebarRightProps["header"];
}) {
  if (!header) {
    return null;
  }

  return (
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            render={<NavigationLink href={header.href} title={header.title} />}
            size="lg"
          >
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{header.title}</span>
              {!!header.description && (
                <SidebarMenuDescription lang={header.descriptionLanguage}>
                  {header.description}
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
          className="fixed top-20 right-6 size-9 bg-background/80 backdrop-blur-xs xl:hidden"
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
        <SidebarRightHeader header={header} />
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
