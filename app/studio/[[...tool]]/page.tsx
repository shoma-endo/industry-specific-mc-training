import { redirect } from 'next/navigation';

export default function StudioRedirectPage() {
  // /studio は廃止されました。/setup に移行してください
  redirect('/setup');
}