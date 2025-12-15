import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
import { Separator } from "@repo/design-system/components/ui/separator";
import { ArrowDownIcon, ArrowRightIcon } from "lucide-react";

type Props = {
  labels: {
    wall: string;
    landArea: string;
    fence: string;
    fenceShape: string;
    barbedWire: string;
  };
};

export function Illustration({ labels }: Props) {
  return (
    <Card>
      <CardContent>
        <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
          <div className="relative m-6 mr-18 flex flex-col items-center justify-center rounded-none border border-foreground">
            <div className="mx-auto w-full bg-muted p-4">
              <p className="text-center font-medium text-sm">{labels.wall}</p>
            </div>
            <div className="w-full">
              <p className="px-4 py-8 text-center font-medium text-sm">
                {labels.landArea}
              </p>
            </div>

            <p className="absolute bottom-4 -left-4 text-center font-medium text-sm">
              <InlineMath math="y" />
            </p>
            <p className="absolute -right-4 bottom-4 text-center font-medium text-sm">
              <InlineMath math="y" />
            </p>
            <p className="absolute inset-x-0 -bottom-6 text-center font-medium text-sm">
              <InlineMath math="x" />
            </p>

            <div className="absolute -right-16 flex items-center gap-2">
              <ArrowRightIcon className="size-4" />
              <span className="font-medium text-sm">{labels.fence}</span>
            </div>
          </div>

          <div className="flex w-full flex-col">
            <p className="text-center font-medium text-sm">
              {labels.fenceShape}
            </p>
            <div className="flex flex-col gap-4 border-foreground border-x py-2">
              {Array.from({ length: 4 }, (_, i) => `separator-${i}`).map(
                (id) => (
                  <Separator className="bg-foreground" key={id} />
                )
              )}
            </div>

            <div className="flex flex-col items-center gap-2">
              <ArrowDownIcon className="size-4" />
              <span className="font-medium text-sm">{labels.barbedWire}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
