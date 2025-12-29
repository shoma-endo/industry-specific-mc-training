import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/server/middleware/auth.middleware';
import { getUserRole, isAdmin } from '@/authUtils';
import { PromptService } from '@/server/services/promptService';
import { ChatError, ChatErrorCode } from '@/domain/errors/ChatError';
import { ERROR_MESSAGES } from '@/domain/errors/error-messages';
import { z } from 'zod';
import {
  isViewModeEnabled,
  resolveViewModeRole,
  VIEW_MODE_ERROR_MESSAGE,
} from '@/server/lib/view-mode';

const promptVariableSchema = z.object({
  name: z.string(),
  description: z.string(),
});

const promptSchema = z.object({
  name: z.string(),
  display_name: z.string(),
  content: z.string(),
  variables: z.array(promptVariableSchema).default([]),
});

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const bearer = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : undefined;
    const liffAccessToken = bearer || request.cookies.get('line_access_token')?.value;
    const refreshToken = request.cookies.get('line_refresh_token')?.value;

    if (!liffAccessToken) {
      return NextResponse.json({ success: false, error: 'LINE認証が必要です' }, { status: 401 });
    }

    const authResult = await authMiddleware(liffAccessToken, refreshToken);
    if (authResult.error) {
      const isTokenExpired = authResult.error.includes('expired');
      const errorCode = isTokenExpired ? ChatErrorCode.TOKEN_EXPIRED : ChatErrorCode.AUTHENTICATION_FAILED;
      const chatError = new ChatError(authResult.error, errorCode);
      return NextResponse.json(
        {
          success: false,
          error: chatError.userMessage,
        },
        { status: 401 }
      );
    }

    const role = await getUserRole(liffAccessToken);
    if (!isAdmin(role)) {
      return NextResponse.json({ success: false, error: '管理者権限がありません' }, { status: 403 });
    }

    const { pathname } = request.nextUrl;
    const id = pathname.split('/').pop() as string;
    const template = await PromptService.getTemplateWithVersions(id);
    if (!template) {
      return NextResponse.json({ success: false, error: '見つかりません' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    console.error('Admin prompt detail API error:', error);
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.COMMON.SERVER_ERROR },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const bearer = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : undefined;
    const liffAccessToken = bearer || request.cookies.get('line_access_token')?.value;
    const refreshToken = request.cookies.get('line_refresh_token')?.value;

    if (!liffAccessToken) {
      return NextResponse.json({ success: false, error: 'LINE認証が必要です' }, { status: 401 });
    }

    const authResult = await authMiddleware(liffAccessToken, refreshToken);
    if (authResult.error) {
      const isTokenExpired = authResult.error.includes('expired');
      const errorCode = isTokenExpired ? ChatErrorCode.TOKEN_EXPIRED : ChatErrorCode.AUTHENTICATION_FAILED;
      const chatError = new ChatError(authResult.error, errorCode);
      return NextResponse.json(
        {
          success: false,
          error: chatError.userMessage,
        },
        { status: 401 }
      );
    }
    if (await isViewModeEnabled(resolveViewModeRole(authResult))) {
      return NextResponse.json(
        { success: false, error: VIEW_MODE_ERROR_MESSAGE },
        { status: 403 }
      );
    }

    const role = await getUserRole(liffAccessToken);
    if (!isAdmin(role)) {
      return NextResponse.json({ success: false, error: '管理者権限がありません' }, { status: 403 });
    }

    const { pathname } = request.nextUrl;
    const id = pathname.split('/').pop() as string;

    const body = await request.json();
    const validated = promptSchema.parse(body);

    const updateInput = {
      name: validated.name,
      display_name: validated.display_name,
      content: validated.content,
      variables: validated.variables,
      updated_by: authResult.userId!,
    } as const;

    const result = await PromptService.updateTemplate(id, updateInput);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Admin prompt update API error:', error);
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.COMMON.SERVER_ERROR },
      { status: 500 }
    );
  }
}
