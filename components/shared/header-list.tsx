import type { LucideIcon } from "lucide-react";
import { Particles } from "../ui/particles";

type Props = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export function HeaderList({ title, description, icon: Icon }: Props) {
  return (
    <div className="relative border-b py-10">
      <Particles className="pointer-events-none absolute inset-0 opacity-50" />
      <div className="z-10 mx-auto max-w-3xl space-y-2 px-4">
        <div className="flex items-center gap-2">
          <Icon className="size-6" />
          <h1 className="font-medium text-3xl leading-tight tracking-tight">
            {title}
          </h1>
        </div>
        <p className="text-foreground/80">{description}</p>
      </div>
    </div>
  );
}
