import { createFileRoute, getRouteApi, Outlet } from "@tanstack/react-router";
import { IntlProvider } from "use-intl";
import { Footer } from "@/components/marketing/shared/footer";
import { Header } from "@/components/marketing/shared/header";
import { AppProviders } from "@/components/providers/app";
import { SharedProviders } from "@/components/providers/shared";
import { readRouteMessages } from "@/lib/i18n/messages.fn";
import { readMarketingShellFn } from "@/lib/marketing/shell.fn";

/**
 * The messages of the marketing pages that the locale route does not carry. The
 * Common, State and Toast messages come from the locale route, once.
 */
const MARKETING_NAMESPACES = [
  "About",
  "Ai",
  "AnalyticsConsent",
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
  "Subject",
  "Tryouts",
] as const;

const localeRoute = getRouteApi("/$locale");

/**
 * The marketing group: the home, pricing, contributor and legal pages share one
 * message set, the app and shared providers, and the site header and footer.
 * The navigation of the shell is read on the server, so the loader imports no
 * server-only module.
 */
export const Route = createFileRoute("/$locale/_marketing")({
  loader: async ({ params }) => {
    const [messages, shell] = await Promise.all([
      readRouteMessages({
        data: { locale: params.locale, namespaces: MARKETING_NAMESPACES },
      }),
      readMarketingShellFn({ data: { locale: params.locale } }),
    ]);
    return { ...shell, messages };
  },
  component: MarketingLayout,
});

/** Renders the marketing subtree inside its site shell. */
function MarketingLayout() {
  const { locale } = Route.useParams();
  const { articleNavigation, messages, pageNavigation } = Route.useLoaderData();
  const shellMessages = localeRoute.useLoaderData();
  return (
    <IntlProvider locale={locale} messages={{ ...shellMessages, ...messages }}>
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
