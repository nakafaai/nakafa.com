export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative mx-auto min-h-[calc(100svh-4rem)] max-w-3xl px-6 py-10 sm:py-20 lg:min-h-svh">
      {children}
    </main>
  );
}
