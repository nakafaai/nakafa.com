import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Array as Arr } from "effect";

const topics = [
  "Numbers and operations",
  "Exponents and logarithms",
  "Linear equations",
  "Quadratic functions",
  "Sequences and series",
  "Trigonometry",
  "Vectors",
  "Statistics",
  "Probability",
  "Limits",
  "Derivatives",
  "Integrals",
];

export const card = {
  name: "ScrollArea",
  group: "Content",
  height: 260,
  source: "scroll-area",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="p-6">
      <ScrollArea className="h-48 w-64 rounded-md border" scrollFade>
        <div className="p-4">
          <p className="mb-3 text-sm font-medium">Mathematics topics</p>
          {Arr.map(topics, (topic) => (
            <div key={topic}>
              <p className="text-sm">{topic}</p>
              <Separator className="my-2" />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
