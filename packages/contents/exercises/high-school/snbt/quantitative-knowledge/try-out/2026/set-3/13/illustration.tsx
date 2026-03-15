export function Illustration() {
  return (
    <div className="grid grid-cols-1 divide-y border border-foreground sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {Array.from({ length: 3 }, (_, i) => `separator-${i}`).map((id) => (
        <div className="size-24 border-foreground" key={id} />
      ))}
    </div>
  );
}
