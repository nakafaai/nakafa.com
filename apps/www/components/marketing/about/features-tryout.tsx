import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { TryoutChoicePreview } from "@/components/tryout/runtime/preview.client";

type FeaturedTryout = FunctionReturnType<
  typeof api.tryouts.queries.catalog.getFeaturedQuestion
>;

export interface FeaturesTryoutModel {
  readonly choices: FeaturedTryout["choices"];
  readonly question: ReactNode;
}

/** Shows one signed production question with the established landing surface. */
export function FeaturesTryout({
  value,
}: {
  readonly value: FeaturesTryoutModel;
}) {
  const t = useTranslations("Features");

  return (
    <div className="relative flex min-h-[38rem] flex-col overflow-hidden border-b bg-background lg:col-span-5 lg:min-h-[40rem]">
      <h3 className="text-balance p-8 text-3xl tracking-tight sm:text-4xl lg:p-10">
        {t.rich("tryout-title", {
          mark: (chunks) => <mark>{chunks}</mark>,
        })}
      </h3>
      <article className="mt-auto px-8 pt-10 pb-8 lg:px-10 lg:pt-12 lg:pb-10">
        <section className="my-6">{value.question}</section>
        <section className="my-8">
          <TryoutChoicePreview choices={value.choices} />
        </section>
      </article>
    </div>
  );
}
