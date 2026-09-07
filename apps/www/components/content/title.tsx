/** Gives lessons and articles one centered reading title and optional summary. */
export function ContentTitle({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="relative py-20">
      <div className="mx-auto max-w-3xl space-y-6 px-6 text-center">
        <h1 className="text-balance font-normal font-serif text-5xl leading-tight tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="mx-auto max-w-2xl text-pretty text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </header>
  );
}
