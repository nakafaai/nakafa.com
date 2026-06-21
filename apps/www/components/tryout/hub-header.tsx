interface TryoutHubHeaderProps {
  greeting: string;
  title: string;
}

/** Renders the stable server-authenticated header for the tryout hub. */
export function TryoutHubHeader({ greeting, title }: TryoutHubHeaderProps) {
  return (
    <div className="flex flex-col gap-2">
      <p>{greeting}</p>
      <h1 className="text-pretty font-medium text-3xl tracking-tight">
        {title}
      </h1>
    </div>
  );
}
