import "@fontsource-variable/inter";
import "@fontsource/amiri/arabic-400.css";
import "@fontsource/amiri/latin-400.css";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { cn } from "cn";
import { Announcer } from "@/components/navigation/announcer";
import { THEME_PREPAINT_SCRIPT } from "@/lib/theme/prepaint";
import appCss from "@/styles/globals.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: the script text is built from constants only.
          dangerouslySetInnerHTML={{ __html: THEME_PREPAINT_SCRIPT }}
        />
        <HeadContent />
      </head>
      <body className={cn("touch-manipulation font-sans antialiased")}>
        <Announcer />
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
