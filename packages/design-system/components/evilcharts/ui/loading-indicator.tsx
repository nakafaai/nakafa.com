function LoadingIndicator({ isLoading }: { isLoading: boolean }) {
  if (!isLoading) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div className="flex items-center justify-center gap-2 rounded-md border bg-background px-2 py-0.5 text-primary text-sm">
        <div className="h-3 w-3 animate-spin rounded-full border border-border border-t-primary" />
        <span>Loading</span>
      </div>
    </div>
  );
}

export { LoadingIndicator };
