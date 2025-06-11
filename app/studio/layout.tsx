export default function StudioLayout({ children }: { children: React.ReactNode }) {
  // /studio は廃止されました。/setup に移行してください
  return (
    <div className="h-full flex flex-col">
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}