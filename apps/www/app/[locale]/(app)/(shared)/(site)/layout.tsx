import { locale as rootLocale } from "next/root-params";
import { Footer } from "@/components/marketing/shared/footer";
import { Header } from "@/components/marketing/shared/header";
import { getArticleNavigation } from "@/lib/content/article/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** Renders the marketing subtree inside its dedicated site shell. */
export default async function Layout({ children }: LayoutProps<"/[locale]">) {
  const locale = getLocaleOrThrow(await rootLocale());
  const articleNavigation = await getArticleNavigation(locale);

  return (
    <main
      className="flex min-h-screen w-full flex-1 flex-col"
      data-marketing-page
    >
      <Header />
      {children}
      <Footer articleNavigation={articleNavigation} />
    </main>
  );
}
