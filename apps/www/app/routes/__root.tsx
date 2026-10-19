import "@fontsource-variable/inter";
import { Announcer } from "@/components/navigation/announcer";
import { THEME_PREPAINT_SCRIPT } from "@/lib/theme/prepaint";
import appCss from "@/styles/globals.css?url";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";

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
        <script dangerouslySetInnerHTML={{ __html: THEME_PREPAINT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        <Announcer />
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
