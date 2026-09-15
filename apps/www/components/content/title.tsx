/** Gives lessons and articles one left-aligned reading title and optional summary. */
export function ContentTitle({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="relative py-20">
      <div className="mx-auto max-w-3xl space-y-6 px-6">
        <h1 className="wrap-anywhere hyphens-auto text-balance font-normal text-5xl leading-tight tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-pretty text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </header>
  );
}
