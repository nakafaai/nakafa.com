import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { TryoutCatalogGrid } from "@/components/tryout/catalog-grid";
import { TryoutHubHeader } from "@/components/tryout/hub-header";
import { getTryoutPublicPathHref } from "@/components/tryout/routes";
import { fetchAuthQuery, getToken } from "@/lib/auth/server";
import { fetchTryoutCountries, fetchTryoutExams } from "@/lib/tryout/catalog";

/** Renders the server-backed try-out hub with country-first discovery. */
export async function TryoutHubPage({ locale }: { locale: Locale }) {
  const [countries, tHome, tTryouts, token] = await Promise.all([
    fetchTryoutCountries({ locale }),
    getTranslations({ locale, namespace: "Home" }),
    getTranslations({ locale, namespace: "Tryouts" }),
    getToken(),
  ]);
  const currentUser = token
    ? await Effect.runPromise(
        Effect.tryPromise({
          try: () => fetchAuthQuery(api.auth.queries.getCurrentUser, {}),
          catch: (cause) => cause,
        }).pipe(Effect.catchAll(() => Effect.succeed(null)))
      )
    : null;
  const userName = currentUser?.appUser.name ?? tHome("guest");
  const countryRows = await Promise.all(
    countries.map(async (country) => ({
      country,
      examCount: (
        await fetchTryoutExams({
          locale,
          publicPath: country.publicPath,
        })
      ).length,
    }))
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <TryoutHubHeader
          greeting={tHome("greeting", { name: userName })}
          title={tTryouts("title")}
        />

        <TryoutCatalogGrid
          emptyLabel={tTryouts("list-empty")}
          items={countryRows.map(({ country, examCount }) => ({
            badge: tTryouts("exam-count", { count: examCount }),
            ctaLabel: tTryouts("open-country-cta"),
            description: country.description,
            href: getTryoutPublicPathHref(country.publicPath),
            title: country.title,
          }))}
        />
      </div>
    </div>
  );
}
