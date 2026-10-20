import { createFileRoute, Outlet } from "@tanstack/react-router";
import { IntlProvider } from "use-intl";
import { Footer } from "@/components/marketing/shared/footer";
import { Header } from "@/components/marketing/shared/header";
import { AppProviders } from "@/components/providers/app";
import { SharedProviders } from "@/components/providers/shared";
import { getShellArticleNavigation } from "@/lib/content/article/navigation";
import { getShellPageNavigation } from "@/lib/content/page/navigation";
import { readRouteMessages } from "@/lib/i18n/messages.fn";

/** The messages of the marketing pages, which the shell messages join. */
const MARKETING_NAMESPACES = [
  "About",
  "Common",
  "Contributor",
  "Faq",
  "Holy",
  "Landing",
  "Legal",
  "Marketing",
  "Memory",
  "Metadata",
  "Pricing",
  "PricingPage",
  "SEO",
  "SchoolStart",
  "State",
  "Subject",
  "Toast",
  "Tryouts",
] as const;

/**
 * The marketing group: the home, pricing, contributor and legal pages share one
 * message set, the app and shared providers, and the site header and footer.
 */
export const Route = createFileRoute("/$locale/_marketing")({
  loader: async ({ params }) => {
    const [messages, articleNavigation, pageNavigation] = await Promise.all([
      readRouteMessages({
        data: { locale: params.locale, namespaces: MARKETING_NAMESPACES },
      }),
      getShellArticleNavigation(params.locale),
      getShellPageNavigation(params.locale),
    ]);
    return { articleNavigation, messages, pageNavigation };
  },
  component: MarketingLayout,
});

/** Renders the marketing subtree inside its site shell. */
function MarketingLayout() {
  const { locale } = Route.useParams();
  const { articleNavigation, messages, pageNavigation } = Route.useLoaderData();
  return (
    <IntlProvider locale={locale} messages={messages}>
      <AppProviders pageNavigation={pageNavigation}>
        <SharedProviders>
          <main
            className="flex min-h-screen w-full flex-1 flex-col"
            data-marketing-page
          >
            <Header />
            <Outlet />
            <Footer
              articleNavigation={articleNavigation}
              pageNavigation={pageNavigation}
            />
          </main>
        </SharedProviders>
      </AppProviders>
    </IntlProvider>
  );
}
