import Link from 'next/link';

export const metadata = {
	title: 'CMS 管理画面',
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="h-full">
			<nav className="p-4 border-b">
				<Link href="/" className="text-blue-600 hover:underline">マイホームへ戻る</Link>
			</nav>
			<main className="p-6">{children}</main>
		</div>
	);
}
