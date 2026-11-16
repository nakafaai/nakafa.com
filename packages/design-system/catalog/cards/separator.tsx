import { Separator } from "@repo/design-system/components/ui/separator";

export const card = {
  name: "Separator",
  group: "Content",
  height: 140,
  source: "separator",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="max-w-sm p-6 text-sm">
      <p className="font-medium">Nakafa</p>
      <p className="text-muted-foreground">Free learning for every student.</p>
      <Separator className="my-4" />
      <div className="flex h-5 items-center gap-4">
        <span>Subjects</span>
        <Separator orientation="vertical" />
        <span>Exams</span>
        <Separator orientation="vertical" />
        <span>Nina</span>
      </div>
    </div>
  );
}
