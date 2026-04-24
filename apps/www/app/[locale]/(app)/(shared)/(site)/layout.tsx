import { Footer } from "@/components/marketing/shared/footer";
import { Header } from "@/components/marketing/shared/header";

/** Renders the marketing subtree inside its dedicated site shell. */
export default function Layout({ children }: LayoutProps<"/[locale]">) {
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
