import { cookies } from 'next/headers';

export const VIEW_MODE_ERROR_MESSAGE = '閲覧モードでは操作できません';

export const isViewModeEnabled = async (): Promise<boolean> => {
  const cookieStore = await cookies();
  return cookieStore.get('owner_view_mode')?.value === '1';
};
