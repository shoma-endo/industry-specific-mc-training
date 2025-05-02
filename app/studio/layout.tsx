export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col">
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
