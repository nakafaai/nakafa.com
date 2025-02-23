import { Particles } from "../ui/particles";

type Props = {
  title: string;
  description?: string;
};

export function HeaderContent({ title, description }: Props) {
  return (
    <div className="relative border-b py-10">
      <Particles className="pointer-events-none absolute inset-0" />
      <div className="mx-auto max-w-3xl space-y-2 px-4">
        <h1 className="font-medium text-3xl tracking-tight">{title}</h1>
        {description && <p className="text-foreground/80">{description}</p>}
      </div>
    </div>
  );
}
