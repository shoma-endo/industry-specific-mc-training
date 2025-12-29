'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getPromptTemplates, updatePromptTemplate } from '@/server/actions/prompt.actions';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import {
  isViewModeEnabled,
  resolveViewModeRole,
  VIEW_MODE_ERROR_MESSAGE,
} from '@/server/lib/view-mode';

const getAccessTokenOrError = async () => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('line_access_token')?.value;
  const refreshToken = cookieStore.get('line_refresh_token')?.value;
  const authResult = await authMiddleware(accessToken, refreshToken);
  if (authResult.error || !authResult.userId) {
    return { error: authResult.error || 'ユーザー認証に失敗しました' };
  }
  if (authResult.userDetails?.role !== 'admin') {
    return { error: '権限がありません' };
  }
  return { accessToken: accessToken ?? '', authResult };
};

export async function fetchPrompts() {
  try {
    const auth = await getAccessTokenOrError();
    if ('error' in auth) {
      return { success: false, error: auth.error };
    }

    const result = await getPromptTemplates(auth.accessToken);
    if (!result.success) {
      return { success: false, error: result.error || 'プロンプトの取得に失敗しました' };
    }
    return { success: true, data: result.data };
  } catch (error) {
    console.error('[admin/prompts] fetch failed', error);
    return { success: false, error: 'プロンプトの取得に失敗しました' };
  }
}

export async function savePrompt(params: {
  id: string;
  name: string;
  display_name: string;
  content: string;
  variables: unknown;
}) {
  try {
    const auth = await getAccessTokenOrError();
    if ('error' in auth) {
      return { success: false, error: auth.error };
    }
    if (await isViewModeEnabled(resolveViewModeRole(auth.authResult))) {
      return { success: false, error: VIEW_MODE_ERROR_MESSAGE };
    }

    const variables =
      Array.isArray(params.variables) && params.variables.length > 0
        ? params.variables.filter(
            (v): v is { name: string; description: string } =>
              v != null &&
              typeof (v as { name?: unknown }).name === 'string' &&
              typeof (v as { description?: unknown }).description === 'string'
          )
        : [];

    const result = await updatePromptTemplate(auth.accessToken, params.id, {
      name: params.name,
      display_name: params.display_name,
      content: params.content,
      variables,
    });

    if (!result.success) {
      return { success: false, error: result.error || '保存に失敗しました' };
    }

    revalidatePath('/admin/prompts');
    return { success: true };
  } catch (error) {
    console.error('[admin/prompts] save failed', error);
    return { success: false, error: '保存に失敗しました' };
  }
}
