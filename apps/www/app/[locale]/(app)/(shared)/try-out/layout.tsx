import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { TryoutShell } from "@/components/tryout/shell/client";
import { getShellArticleNavigation } from "@/lib/content/article/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** Renders the shared tryout shell for every route in the tryout subtree. */
export default async function Layout({
  children,
}: LayoutProps<"/[locale]/try-out">) {
  const locale = getLocaleOrThrow(await rootLocale());
  const articleNavigation = await getShellArticleNavigation(locale);

  return (
    <Suspense fallback={null}>
      <TryoutShell articleNavigation={articleNavigation}>
        {children}
      </TryoutShell>
    </Suspense>
  );
}
