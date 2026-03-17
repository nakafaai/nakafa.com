import { api } from "@repo/backend/convex/_generated/api";
import { Badge } from "@repo/design-system/components/ui/badge";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { fetchQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

interface Props {
  params: Promise<{ locale: Locale; product: string; slug: string }>;
}

export default async function Page({ params }: Props) {
  const { locale, product, slug } = await params;

  setRequestLocale(locale);

  if (product !== "snbt") {
    notFound();
  }

  const [tCommon, tTryouts, details] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Tryouts" }),
    fetchQuery(api.tryouts.queries.tryouts.getTryoutDetails, {
      locale,
      product: "snbt",
      slug,
    }),
  ]);

  if (!details) {
    notFound();
  }

  const tryoutLabel = details.tryout.label.replaceAll("-", " ");

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <header className="flex flex-col gap-3">
          <NavigationLink
            className="w-fit font-medium text-primary text-sm underline-offset-4 hover:underline"
            href="/try-out/snbt"
          >
            {tCommon("back")}
          </NavigationLink>

          <div className="flex flex-wrap gap-2">
            <Badge variant="muted-outline">
              {tTryouts("products.snbt.title")}
            </Badge>
            <Badge variant="muted">{details.tryout.cycleKey}</Badge>
          </div>

          <h1 className="text-pretty font-medium text-4xl capitalize tracking-tight">
            {tryoutLabel}
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            {tTryouts("slug-description")}
          </p>
          <p className="text-muted-foreground text-sm">
            {tTryouts("available-item-description", {
              parts: details.tryout.partCount,
              questions: details.tryout.totalQuestionCount,
            })}
          </p>
        </header>

        <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="font-medium">{tTryouts("part-list-title")}</h2>
          </div>

          <div className="grid divide-y">
            {details.parts.map((part) => (
              <div className="px-5 py-4" key={part.partKey}>
                <div className="space-y-1">
                  <p className="font-medium">{part.title}</p>
                  <p className="text-muted-foreground text-sm">
                    {part.questionCount} {tTryouts("question-unit")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
