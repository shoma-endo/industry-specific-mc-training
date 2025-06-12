import { redirect } from 'next/navigation';

// このデバッグページは廃止されました
export default function DraftModeDebugPage() {
  redirect('/setup');
}