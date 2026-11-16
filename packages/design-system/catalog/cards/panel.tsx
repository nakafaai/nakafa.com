import { ArrowRight02Icon, BookOpen02Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";

export const card = {
  name: "Card",
  group: "Content",
  height: 320,
  source: "card",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>Quadratic Functions</CardTitle>
          <CardDescription>Grade 10 mathematics</CardDescription>
          <CardAction>
            <Badge variant="muted">12 lessons</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <HugeIcons icon={BookOpen02Icon} />
            Graphs, vertex form and roots.
          </p>
        </CardContent>
        <CardFooter>
          <Button>
            Start learning
            <HugeIcons icon={ArrowRight02Icon} />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
