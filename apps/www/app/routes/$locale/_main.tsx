import { monospace } from "@repo/design-system/lib/monospace";
import { LocaleSchema } from "@repo/internationalization/src/locale";
import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { cn } from "cn";
import { Schema } from "effect";
import { AppShell } from "@/components/sidebar/shell";
import { getShellArticleNavigation } from "@/lib/content/article/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";

const ShellInput = Schema.Struct({ locale: Schema.String });

/** The article navigation of the shell, read on the server for every learn page. */
const readShellNavigation = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ShellInput))
  .handler(({ data }) =>
    getShellArticleNavigation(getLocaleOrThrow(data.locale))
  );

/**
 * The student shell that every learn page shares, as the (main) layout of the
 * reference app. An unknown locale stops before any page loads.
 */
export const Route = createFileRoute("/$locale/_main")({
  beforeLoad: ({ params }) => {
    if (!Schema.is(LocaleSchema)(params.locale)) {
      throw notFound();
    }
  },
  loader: ({ params }) =>
    readShellNavigation({ data: { locale: params.locale } }),
  component: MainLayout,
});

function MainLayout() {
  const articleNavigation = Route.useLoaderData();
  return (
    <AppShell articleNavigation={articleNavigation}>
      <div className={cn(monospace, "contents")}>
        <Outlet />
      </div>
    </AppShell>
  );
}
