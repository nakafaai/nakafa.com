import { use } from "react";
import { Footer } from "@/components/marketing/shared/footer";
import { Header } from "@/components/marketing/shared/header";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** Renders the marketing subtree inside its dedicated site shell. */
export default function Layout(props: LayoutProps<"/[locale]">) {
  const { children, params } = props;
  getLocaleOrThrow(use(params).locale);

  return (
    <main
      className="flex min-h-screen w-full flex-1 flex-col"
      data-marketing-page
    >
      <Header />
      {children}
      <Footer />
    </main>
  );
}
