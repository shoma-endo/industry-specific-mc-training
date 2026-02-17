'use server';

import { authMiddleware } from '@/server/middleware/auth.middleware';
import { headingFlowService } from '@/server/services/headingFlowService';
import { ERROR_MESSAGES } from '@/domain/errors/error-messages';
import { z } from 'zod';
import type { DbHeadingSection } from '@/types/heading-flow';

const initializeHeadingSchema = z.object({
  sessionId: z.string(),
  step5Markdown: z.string(),
  liffAccessToken: z.string(),
});

const saveHeadingSectionSchema = z.object({
  sessionId: z.string(),
  headingKey: z.string(),
  content: z.string(),
  liffAccessToken: z.string(),
});

const getHeadingSectionsSchema = z.object({
  sessionId: z.string(),
  liffAccessToken: z.string(),
});

const getLatestCombinedContentSchema = z.object({
  sessionId: z.string(),
  liffAccessToken: z.string(),
});

/**
 * セッションへの読み取り権限を確認する。
 */
async function verifySessionReadAccess(sessionId: string, userId: string) {
  const sessionRes = await headingFlowService.getChatSessionById(sessionId, userId);
  return sessionRes.success && !!sessionRes.data;
}

/**
 * Step 5確定時に呼び出し、見出しセクションを初期化する。
 */
export async function initializeHeadingSections(data: z.infer<typeof initializeHeadingSchema>) {
  const parsed = initializeHeadingSchema.parse(data);
  const auth = await authMiddleware(parsed.liffAccessToken);

  if (auth.error || !auth.userId) {
    return { success: false, error: auth.error ?? ERROR_MESSAGES.AUTH.USER_AUTH_FAILED };
  }

  // 認可チェック: 読み取り権限
  if (!(await verifySessionReadAccess(parsed.sessionId, auth.userId))) {
    return { success: false, error: 'セッションへのアクセス権がありません' };
  }

  // 認可チェック: 書き込み権限（閲覧専用ロール・ビューモードは拒否）
  if (auth.viewMode || auth.userDetails?.role === 'owner') {
    return { success: false, error: '閲覧モードでは編集できません' };
  }

  const result = await headingFlowService.initializeHeadingSections(
    parsed.sessionId,
    parsed.step5Markdown
  );
  if (!result.success) {
    return { success: false, error: result.error.userMessage };
  }

  return { success: true };
}

/**
 * 全ての見出しセクションを取得する。
 */
export async function getHeadingSections(data: z.infer<typeof getHeadingSectionsSchema>) {
  const parsed = getHeadingSectionsSchema.parse(data);
  const auth = await authMiddleware(parsed.liffAccessToken);

  if (auth.error || !auth.userId) {
    return { success: false, error: auth.error ?? ERROR_MESSAGES.AUTH.USER_AUTH_FAILED, data: [] };
  }

  // 認可チェック
  if (!(await verifySessionReadAccess(parsed.sessionId, auth.userId))) {
    return { success: false, error: 'セッションへのアクセス権がありません', data: [] };
  }

  const result = await headingFlowService.getHeadingSections(parsed.sessionId);
  if (!result.success) {
    return { success: false, error: result.error.userMessage, data: [] };
  }

  // Frontend用の型に変換
  const sections = (result.data as DbHeadingSection[]).map(s => ({
    id: s.id,
    headingKey: s.heading_key,
    headingLevel: s.heading_level,
    headingText: s.heading_text,
    orderIndex: s.order_index,
    content: s.content,
    isConfirmed: s.is_confirmed,
  }));

  return { success: true, data: sections };
}

/**
 * 見出しセクションを保存し、完成形を更新する。
 */
export async function saveHeadingSection(data: z.infer<typeof saveHeadingSectionSchema>) {
  const parsed = saveHeadingSectionSchema.parse(data);
  const auth = await authMiddleware(parsed.liffAccessToken);

  if (auth.error || !auth.userId) {
    return { success: false, error: auth.error ?? ERROR_MESSAGES.AUTH.USER_AUTH_FAILED };
  }

  // 認可チェック: 読み取り権限
  if (!(await verifySessionReadAccess(parsed.sessionId, auth.userId))) {
    return { success: false, error: 'セッションへのアクセス権がありません' };
  }

  // 認可チェック: 書き込み権限（閲覧専用ロール・ビューモードは拒否）
  if (auth.viewMode || auth.userDetails?.role === 'owner') {
    return { success: false, error: '閲覧モードでは編集できません' };
  }

  const result = await headingFlowService.saveHeadingSection(
    parsed.sessionId,
    parsed.headingKey,
    parsed.content,
    auth.userId
  );
  if (!result.success) {
    return { success: false, error: result.error.userMessage };
  }

  return { success: true };
}

/**
 * 最新の完成形を取得する（Step 7用）。
 */
export async function getLatestCombinedContent(
  data: z.infer<typeof getLatestCombinedContentSchema>
) {
  const parsed = getLatestCombinedContentSchema.parse(data);
  const auth = await authMiddleware(parsed.liffAccessToken);

  if (auth.error || !auth.userId) {
    return {
      success: false,
      error: auth.error ?? ERROR_MESSAGES.AUTH.USER_AUTH_FAILED,
      data: null,
    };
  }

  // 認可チェック
  if (!(await verifySessionReadAccess(parsed.sessionId, auth.userId))) {
    return { success: false, error: 'セッションへのアクセス権がありません', data: null };
  }

  const result = await headingFlowService.getLatestCombinedContent(parsed.sessionId);
  if (!result.success) {
    return { success: false, error: result.error.userMessage, data: null };
  }

  return { success: true, data: result.data };
}
