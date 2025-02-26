import { format } from "date-fns";
import { CalendarIcon, type LucideIcon, PencilLineIcon } from "lucide-react";
import { Particles } from "../ui/particles";

type Props = {
  title: string;
  description?: string;
  category: {
    icon: LucideIcon;
    name: string;
  };
  authors: {
    name: string;
  }[];
  date: string;
};

export function HeaderContent({
  title,
  description,
  category,
  authors,
  date,
}: Props) {
  return (
    <div className="relative border-b py-10">
      <Particles className="pointer-events-none absolute inset-0 opacity-50" />
      <div className="z-10 mx-auto max-w-3xl space-y-2 px-4">
        <h1 className="font-medium text-3xl leading-tight tracking-tight">
          {title}
        </h1>
        {description && <p className="text-foreground/80">{description}</p>}
        <div className="flex flex-col justify-between gap-2 pt-2 sm:flex-row sm:items-center sm:gap-4">
          <p className="inline-flex items-center gap-1 text-muted-foreground">
            <PencilLineIcon className="size-4" />
            <span className="text-sm">
              {authors.map((author) => author.name).join(", ")}
            </span>
          </p>

          <div className="flex items-center gap-4">
            <p className="inline-flex items-center gap-1 text-muted-foreground">
              <CalendarIcon className="size-4" />
              <span className="text-sm">
                {format(new Date(date), "d MMM, yyyy")}
              </span>
            </p>

            <p className="inline-flex items-center gap-1 text-muted-foreground">
              <category.icon className="size-4" />
              <span className="text-sm">{category.name}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
