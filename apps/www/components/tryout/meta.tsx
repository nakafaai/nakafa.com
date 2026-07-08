import { Badge } from "@repo/design-system/components/ui/badge";

/** Renders the production try-out header badge strip. */
export function TryoutMeta({ items }: { items: readonly string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge className="capitalize" key={item} variant="muted">
          {item}
        </Badge>
      ))}
    </div>
  );
}
