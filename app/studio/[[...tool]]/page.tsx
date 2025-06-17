import SanityProjectForm from '@/components/SanityProjectForm';
import { StudioClient } from '@/components/StudioClient';
import { getSanityProject } from '@/server/handler/actions/sanity.action';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function StudioPage() {
  const cookieStore = await cookies();
  const liffAccessToken = cookieStore.get('line_access_token')?.value;
  if (!liffAccessToken) {
    return <div>ログインしてください</div>;
  }
  const project = await getSanityProject(liffAccessToken);
  console.log('[Studio Page] Retrieved project:', project);
  
  if (!project) {
    console.log('[Studio Page] No project found, redirecting to setup');
    return <SanityProjectForm liffAccessToken={liffAccessToken} />;
  }
  
  if (!project.project_id || project.project_id.trim() === '') {
    console.log('[Studio Page] Empty project_id found:', project.project_id);
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">エラー: 無効なProject ID</h2>
          <p className="text-gray-600 mb-4">
            データベースにProject IDが正しく保存されていません。
          </p>
          <a href="/setup/sanity" className="text-blue-600 hover:underline">
            設定ページでProject IDを再設定してください
          </a>
        </div>
      </div>
    );
  }
  return (
    <div className="w-full h-screen flex flex-col">
      <div className="flex-1">
        <StudioClient projectId={project.project_id} dataset={project.dataset} />
      </div>
    </div>
  );
}