/** Render the shared user profile shell inside the validated locale subtree. */
export default function Layout({ children }: LayoutProps<"/[locale]/user">) {
  return (
    <main className="relative mx-auto min-h-[calc(100svh-4rem)] max-w-3xl px-6 py-10 sm:py-20 lg:min-h-svh">
      {children}
    </main>
  );
}
