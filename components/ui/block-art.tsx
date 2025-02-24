import { cn } from "@/lib/utils";

type Props = {
  length?: number;
  className?: string;
};

export default function BlockArt({ length = 23, className }: Props) {
  return (
    <section className={cn("mt-24 bg-card-foreground pb-36", className)}>
      {Array.from({ length }).map((_, i) => (
        <div
          key={Math.random()}
          className="bg-card"
          style={{
            marginTop: `${0 + i}px`,
            height: `${23 - i}px`,
          }}
        />
      ))}
    </section>
  );
}
