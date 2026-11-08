import { createFileRoute, getRouteApi, Outlet } from "@tanstack/react-router";
import { IntlProvider } from "use-intl";
import { Footer } from "@/components/marketing/shared/footer";
import { Header } from "@/components/marketing/shared/header";
import { PageProviders } from "@/components/providers/page";
import { SharedProviders } from "@/components/providers/shared";
import { readRouteMessages } from "@/lib/i18n/messages.functions";
import { readMarketingShellFn } from "@/lib/marketing/shell.functions";
import { readStaticData } from "@/lib/static/data";

/**
 * The messages of the marketing pages that the locale route does not carry. The
 * Common, State and Toast messages come from the locale route, once.
 */
const MARKETING_NAMESPACES = [
  "About",
  "Ai",
  "AnalyticsConsent",
  "Contributor",
  "Error",
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
  "SchoolSite",
  "SchoolStart",
  "Subject",
  "Tryouts",
] as const;

const localeRoute = getRouteApi("/$locale");

/**
 * The marketing group: the home, pricing, contributor and legal pages share one
 * message set, the app and shared providers, and the site header and footer.
 * The footer's signed pages are read on the server with the app shell's
 * navigation, so the loader imports no server-only module, and only the pages
 * reach the page.
 */
export const Route = createFileRoute("/$locale/_marketing")({
  loader: async ({ params }) => {
    const [messages, { pageNavigation }] = await Promise.all([
      readStaticData(readRouteMessages, {
        locale: params.locale,
        namespaces: MARKETING_NAMESPACES,
      }),
      readStaticData(readMarketingShellFn, { locale: params.locale }),
    ]);
    return { messages, pageNavigation };
  },
  component: MarketingLayout,
});

/** Renders the marketing subtree inside its site shell. */
function MarketingLayout() {
  const { locale } = Route.useParams();
  const { messages, pageNavigation } = Route.useLoaderData();
  const { messages: shellMessages } = localeRoute.useLoaderData();
  return (
    <IntlProvider locale={locale} messages={{ ...shellMessages, ...messages }}>
      <PageProviders pageNavigation={pageNavigation}>
        <SharedProviders>
          <main
            className="flex min-h-screen w-full flex-1 flex-col"
            data-marketing-page
          >
            <Header />
            <Outlet />
            <Footer pageNavigation={pageNavigation} />
          </main>
        </SharedProviders>
      </PageProviders>
    </IntlProvider>
  );
}
