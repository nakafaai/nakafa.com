import { locale as rootLocale } from "next/root-params";
import { Footer } from "@/components/marketing/shared/footer";
import { Header } from "@/components/marketing/shared/header";
import { getShellArticleNavigation } from "@/lib/content/article/navigation";
import { getShellPageNavigation } from "@/lib/content/page/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** Renders the marketing subtree inside its dedicated site shell. */
export default async function Layout({ children }: LayoutProps<"/[locale]">) {
  const locale = getLocaleOrThrow(await rootLocale());
  const [articleNavigation, pageNavigation] = await Promise.all([
    getShellArticleNavigation(locale),
    getShellPageNavigation(locale),
  ]);

  return (
    <main
      className="flex min-h-screen w-full flex-1 flex-col"
      data-marketing-page
    >
      <Header />
      {children}
      <Footer
        articleNavigation={articleNavigation}
        pageNavigation={pageNavigation}
      />
    </main>
  );
}
