import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { Badge } from "@repo/design-system/components/ui/badge";
import { useTranslations } from "next-intl";

export function formatTryoutLabel(label: string) {
  return label.replaceAll("-", " ");
}

export function TryoutMeta({
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
      <Badge variant="muted">{productTitleByProduct[product]}</Badge>
      <Badge variant="muted">
        {tTryouts("year-title", { year: cycleKey })}
      </Badge>
      {label ? (
        <Badge className="capitalize" variant="muted">
          {label}
        </Badge>
      ) : null}
    </div>
  );
}
