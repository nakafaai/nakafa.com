import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { Badge } from "@repo/design-system/components/ui/badge";
import { useTranslations } from "next-intl";

export function TryoutPageMeta({
  cycleKey,
  label,
  product,
}: {
  cycleKey: string;
  label?: string;
  product: TryoutProduct;
}) {
  const tTryouts = useTranslations("Tryouts");
  const productTitleByProduct = {
    snbt: tTryouts("products.snbt.title"),
  } satisfies Record<TryoutProduct, string>;

  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline">{productTitleByProduct[product]}</Badge>
      <Badge variant="outline">
        {tTryouts("year-title", { year: cycleKey })}
      </Badge>
      {label ? (
        <Badge className="capitalize" variant="outline">
          {label}
        </Badge>
      ) : null}
    </div>
  );
}
