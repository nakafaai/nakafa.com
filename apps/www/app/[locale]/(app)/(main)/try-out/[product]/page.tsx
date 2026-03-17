import { api } from "@repo/backend/convex/_generated/api";
import { Badge } from "@repo/design-system/components/ui/badge";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { fetchQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SnbtTryoutArt } from "@/components/tryout/snbt-art";

interface Props {
  params: Promise<{ locale: Locale; product: string }>;
}

export default async function Page({ params }: Props) {
  const { locale, product } = await params;

  setRequestLocale(locale);

  if (product !== "snbt") {
    notFound();
  }

  const [tTryouts, activeTryouts] = await Promise.all([
    getTranslations({ locale, namespace: "Tryouts" }),
    fetchQuery(api.tryouts.queries.tryouts.getActiveTryouts, {
      locale,
      product: "snbt",
    }),
  ]);

  const groupedTryouts = new Map<string, typeof activeTryouts>();

  for (const tryout of activeTryouts) {
    const cycleTryouts = groupedTryouts.get(tryout.cycleKey);

    if (cycleTryouts) {
      cycleTryouts.push(tryout);
      continue;
    }

    groupedTryouts.set(tryout.cycleKey, [tryout]);
  }

  const cycleGroups = Array.from(groupedTryouts.entries()).map(
    ([cycleKey, tryouts]) => ({ cycleKey, tryouts })
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <header className="flex flex-col gap-3">
          <h1 className="text-pretty font-medium text-4xl tracking-tight">
            {tTryouts("products.snbt.title")}
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            {tTryouts("product-page-description")}
          </p>
        </header>

        <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
            <div className="flex size-28 shrink-0 items-center justify-center rounded-xl bg-muted/40 sm:size-32">
              <SnbtTryoutArt />
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium text-2xl">
                  {tTryouts("products.snbt.title")}
                </h2>
                <Badge variant="muted-outline">
                  {tTryouts("package-count", { count: activeTryouts.length })}
                </Badge>
              </div>

              <p className="text-muted-foreground">
                {tTryouts("products.snbt.description")}
              </p>
            </div>
          </div>

          <div className="border-t">
            {cycleGroups.length === 0 ? (
              <div className="px-5 py-4 text-muted-foreground text-sm">
                {tTryouts("list-empty")}
              </div>
            ) : (
              cycleGroups.map((group, index) => (
                <div
                  className={index === 0 ? "" : "border-t"}
                  key={group.cycleKey}
                >
                  <div className="px-5 pt-4 pb-2 font-medium text-muted-foreground text-sm">
                    {group.cycleKey}
                  </div>

                  <div className="grid">
                    {group.tryouts.map((tryout) => {
                      const tryoutLabel = tryout.label.replaceAll("-", " ");

                      return (
                        <NavigationLink
                          className="group block border-t px-5 py-4 transition-colors ease-out first:border-t-0 hover:bg-accent hover:text-accent-foreground"
                          href={`/try-out/snbt/${tryout.slug}`}
                          key={tryout._id}
                        >
                          <div className="space-y-1">
                            <p className="font-medium capitalize">
                              {tryoutLabel}
                            </p>
                            <p className="text-muted-foreground text-sm group-hover:text-accent-foreground/80">
                              {tTryouts("available-item-description", {
                                parts: tryout.partCount,
                                questions: tryout.totalQuestionCount,
                              })}
                            </p>
                          </div>
                        </NavigationLink>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
