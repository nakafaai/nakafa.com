import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { getMaterialIcon } from "@repo/contents/_lib/subject/material";
import { ExercisesMaterialSchema } from "@repo/contents/_types/exercises/material";
import { Badge } from "@repo/design-system/components/ui/badge";
import { GradientBlock } from "@repo/design-system/components/ui/gradient-block";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
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

  const [tCommon, tExercises, tTryouts, details] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Exercises" }),
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

  const getPartLabel = (partKey: string) => {
    switch (partKey) {
      case "mathematics":
        return tExercises("mathematics");
      case "quantitative-knowledge":
        return tExercises("quantitative-knowledge");
      case "mathematical-reasoning":
        return tExercises("mathematical-reasoning");
      case "general-reasoning":
        return tExercises("general-reasoning");
      case "indonesian-language":
        return tExercises("indonesian-language");
      case "english-language":
        return tExercises("english-language");
      case "general-knowledge":
        return tExercises("general-knowledge");
      case "reading-and-writing-skills":
        return tExercises("reading-and-writing-skills");
      default:
        return partKey;
    }
  };

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
        </header>

        <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="grid divide-y">
            {details.parts.map((part) => {
              const parsedMaterial = ExercisesMaterialSchema.safeParse(
                part.partKey
              );
              const material = parsedMaterial.success
                ? parsedMaterial.data
                : null;
              const partLabel = material
                ? tExercises(material)
                : getPartLabel(part.partKey);
              const partIcon = material ? getMaterialIcon(material) : null;

              return (
                <NavigationLink
                  className="group flex items-center gap-3 p-4 transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
                  href={`/try-out/snbt/${details.tryout.slug}/part/${part.partKey}`}
                  key={part.partKey}
                >
                  <div className="flex flex-1 items-start gap-3">
                    <div className="relative size-10 shrink-0 overflow-hidden rounded-md">
                      <GradientBlock
                        className="absolute inset-0"
                        colorScheme="vibrant"
                        intensity="medium"
                        keyString={part.partKey}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        {!!partIcon && (
                          <HugeIcons
                            className="size-4 text-background drop-shadow-md"
                            icon={partIcon}
                          />
                        )}
                      </div>
                    </div>

                    <div className="-mt-1 flex flex-1 flex-col gap-0.5">
                      <h3>{partLabel}</h3>
                      <span className="line-clamp-1 text-muted-foreground text-sm group-hover:text-accent-foreground/80">
                        {part.questionCount} {tTryouts("question-unit")}
                      </span>
                    </div>
                  </div>

                  <HugeIcons
                    className="size-4 shrink-0 opacity-0 transition-opacity ease-out group-hover:opacity-100"
                    icon={ArrowRight02Icon}
                  />
                </NavigationLink>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
