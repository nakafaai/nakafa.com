import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { themes } from "@repo/design-system/lib/theme/registry";
import { cn } from "cn";
import { Array as Arr } from "effect";

export const card = {
  name: "Themes",
  group: "Identity",
  height: 900,
  source: "lib/theme/registry",
  declaration: "themes",
};

/** Every named theme a learner can pick, each drawing the same components from its own tokens. */
export function Preview() {
  return (
    <div className="grid grid-cols-3 gap-3 p-6">
      {Arr.map(
        Arr.filter(
          themes,
          (theme) =>
            theme.appearance !== "dynamic" &&
            theme.value !== "light" &&
            theme.value !== "dark"
        ),
        (theme) => (
          <div
            className={cn(
              theme.value,
              "bg-background text-foreground flex flex-col gap-3 rounded-xl border p-3"
            )}
            key={theme.value}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium">{theme.value}</p>
              <Badge variant="secondary">{theme.appearance}</Badge>
            </div>
            <div className="flex gap-2">
              <Button size="sm">Start</Button>
              <Button size="sm" variant="outline">
                View
              </Button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
