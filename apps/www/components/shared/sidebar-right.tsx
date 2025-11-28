import type { Reference } from "@repo/contents/_types/content";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@repo/design-system/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { MenuIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { CommentsButton } from "../sidebar/comments-button";
import { GithubButton } from "../sidebar/github-button";
import { ReferenceButton } from "../sidebar/reference-button";
import { ReportButton } from "../sidebar/report-button";
import { ShareButton } from "../sidebar/share-button";

export type SidebarRightProps = {
  children: ReactNode;
  header?: {
    title: string;
    href: string;
    description?: string;
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
          <Tooltip>
            <TooltipTrigger
              render={
                <SidebarMenuButton asChild size="lg">
                  <NavigationLink href={header.href} title={header.title}>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {header.title}
                      </span>
                      {!!header.description && (
                        <span className="truncate text-xs">
                          {header.description}
                        </span>
                      )}
                    </div>
                  </NavigationLink>
                </SidebarMenuButton>
              }
            />
            <TooltipContent
              align="center"
              className="hidden max-w-xs sm:block"
              side="left"
            >
              {header.title}
            </TooltipContent>
          </Tooltip>
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
    <div data-pagefind-ignore>
      <SidebarProvider
        cookieName="sidebar_state:right"
        keyboardShortcut="x"
        sidebarDesktop={1280}
      >
        {/* Mobile trigger button */}
        <SidebarTrigger
          className="fixed top-20 right-6 size-9 bg-background/80 backdrop-blur-xs xl:hidden"
          icon={<MenuIcon />}
          size="icon"
          variant="outline"
        />

        {/* Right sidebar */}
        <Sidebar
          containerClassName="lg:hidden xl:block"
          side="right"
          variant="floating"
          {...props}
        >
          <SidebarRightHeader header={header} />
          <SidebarContent>{children}</SidebarContent>
          <SidebarRightFooter
            githubUrl={githubUrl}
            references={references}
            showComments={showComments}
          />
        </Sidebar>
      </SidebarProvider>
    </div>
  );
}
