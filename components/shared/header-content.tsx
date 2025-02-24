import { format } from "date-fns";
import { CalendarIcon, PencilLineIcon } from "lucide-react";
import { Particles } from "../ui/particles";

type Props = {
  title: string;
  description?: string;
  author?: {
    name: string;
  }[];
  date?: string;
};

export function HeaderContent({ title, description, author, date }: Props) {
  return (
    <div className="relative border-b py-10">
      <Particles className="pointer-events-none absolute inset-0" />
      <div className="z-10 mx-auto max-w-3xl space-y-2 px-4">
        <h1 className="font-medium text-3xl tracking-tight">{title}</h1>
        {description && <p className="text-foreground/80">{description}</p>}
        <div className="flex items-center justify-between gap-2 pt-2">
          {author && (
            <p className="inline-flex items-center gap-1 text-muted-foreground">
              <PencilLineIcon className="size-4" />
              <span className="text-sm">
                {author.map((author) => author.name).join(", ")}
              </span>
            </p>
          )}
          {date && (
            <p className="inline-flex items-center gap-1 text-muted-foreground">
              <CalendarIcon className="size-4" />
              <span className="text-sm">
                {format(new Date(date), "d MMM, yyyy")}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
