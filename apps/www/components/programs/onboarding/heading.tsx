/** Keeps each onboarding step to one focused title and optional short helper. */
export function StepHeading({
  helper,
  title,
}: {
  helper?: string;
  title: string;
}) {
  return (
    <header className="flex flex-col gap-4 text-center">
      <h1 className="text-pretty font-medium text-2xl tracking-tighter sm:text-3xl">
        {title}
      </h1>
      {helper ? (
        <p className="text-pretty text-muted-foreground sm:text-lg">{helper}</p>
      ) : null}
    </header>
  );
}
