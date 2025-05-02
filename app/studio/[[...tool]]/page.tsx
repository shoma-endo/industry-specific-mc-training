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
  if (!project) {
    return <SanityProjectForm liffAccessToken={liffAccessToken} />;
  }
  return (
    <div className="w-full h-screen flex flex-col">
      <div className="flex-1">
        <StudioClient projectId={project.project_id} dataset={project.dataset} />
      </div>
    </div>
  );
}
