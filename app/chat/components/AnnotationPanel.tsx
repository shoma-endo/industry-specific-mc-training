'use client';

import React, { useState, useEffect } from 'react';
import { upsertContentAnnotationBySession } from '@/server/handler/actions/wordpress.action';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ANALYTICS_COLUMNS } from '@/lib/constants';
import { usePersistedResizableWidth } from '@/hooks/usePersistedResizableWidth';
import {
  ANNOTATION_FIELD_KEYS,
  AnnotationFieldKey,
  AnnotationRecord,
} from '@/types/annotation';

type AnnotationFormState = Record<AnnotationFieldKey, string>;

const EMPTY_FORM_ENTRIES = ANNOTATION_FIELD_KEYS.map(key => [key, ''] as const);
const EMPTY_FORM = Object.fromEntries(EMPTY_FORM_ENTRIES) as AnnotationFormState;

const toFormState = (data?: AnnotationRecord | null): AnnotationFormState => {
  return ANNOTATION_FIELD_KEYS.reduce(
    (acc, key) => {
      acc[key] = data?.[key] ?? '';
      return acc;
    },
    { ...EMPTY_FORM }
  );
};

type Props = {
  sessionId: string;
  initialData?: AnnotationRecord | null;
  onClose: () => void;
  isVisible?: boolean;
  onSaveSuccess?: () => void;
};

export default function AnnotationPanel({
  sessionId,
  initialData,
  onClose,
  isVisible = true,
  onSaveSuccess,
}: Props) {
  const [form, setForm] = useState<AnnotationFormState>(() => toFormState(initialData));
  const [loading, setLoading] = React.useState(false);
  const [canonicalUrl, setCanonicalUrl] = React.useState<string>(() =>
    initialData?.canonical_url ?? ''
  );
  const [canonicalUrlError, setCanonicalUrlError] = React.useState<string>('');
  const [saveButtonMessage, setSaveButtonMessage] = React.useState<string>('');
  const [saveButtonMessageType, setSaveButtonMessageType] = React.useState<
    'success' | 'error' | ''
  >('');

  const { width: panelWidth, isResizing, handleMouseDown } = usePersistedResizableWidth({
    storageKey: 'chat-right-panel-width',
    defaultWidth: 450,
    minWidth: 320,
    maxWidth: 1000,
  });
  useEffect(() => {
    setForm(toFormState(initialData));
    setCanonicalUrl(initialData?.canonical_url ?? '');
    setCanonicalUrlError('');
  }, [initialData]);

  const save = async () => {
    const trimmed = canonicalUrl.trim();
    setCanonicalUrlError('');
    let normalizedUrl: string | null = null;

    if (trimmed.length > 0) {
      try {
        const parsed = new URL(trimmed);
        normalizedUrl = parsed.toString();
      } catch {
        setCanonicalUrlError('有効なURLを入力してください');
        return;
      }
    }

    setLoading(true);
    setSaveButtonMessage('');
    try {
      const res = await upsertContentAnnotationBySession({
        session_id: sessionId,
        ...form,
        canonical_url: normalizedUrl,
      });
      if (!res.success) {
        // ボタン上にエラーメッセージを表示
        const message = res.error || '保存に失敗しました';
        setSaveButtonMessage(message);
        setSaveButtonMessageType('error');
        setTimeout(() => {
          setSaveButtonMessage('');
          setSaveButtonMessageType('');
        }, 3000);
        if (res.error && normalizedUrl) {
          setCanonicalUrlError(res.error);
        }
      } else {
        // ボタン上に成功メッセージを表示
        setSaveButtonMessage('保存しました');
        setSaveButtonMessageType('success');
        setTimeout(() => {
          setSaveButtonMessage('');
          setSaveButtonMessageType('');
        }, 3000);

        const nextCanonical =
          res.canonical_url !== undefined ? res.canonical_url ?? '' : normalizedUrl ?? '';
        setCanonicalUrl(nextCanonical);
        setCanonicalUrlError('');

        // 保存成功時のコールバックを呼び出す
        onSaveSuccess?.();
      }
    } catch {
      // ボタン上にエラーメッセージを表示
      setSaveButtonMessage('保存に失敗しました');
      setSaveButtonMessageType('error');
      setTimeout(() => {
        setSaveButtonMessage('');
        setSaveButtonMessageType('');
      }, 3000);
    } finally {
      setLoading(false);
    }
  };
  if (!isVisible) return null;

  return (
    <div
      className={cn('h-full bg-gray-50 border-l flex flex-col relative')}
      style={{ width: panelWidth }}
    >
      {/* リサイザーハンドル - 固定ヘッダー下から開始 */}
      <div
        className={`absolute left-0 top-16 bottom-0 w-1 cursor-col-resize transition-all duration-200 group ${
          isResizing ? 'bg-blue-500 w-2 shadow-lg' : 'bg-gray-200 hover:bg-blue-300 hover:w-1.5'
        }`}
        onMouseDown={handleMouseDown}
        style={{ zIndex: 45 }} // ヘッダーより少し下のz-index
        title="ドラッグして幅を調整"
      >
        {/* リサイザーハンドルの視覚的ヒント */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-0.5 h-8 bg-white/70 rounded-full"></div>
        </div>
      </div>

      {/* ヘッダー部分 - 固定ヘッダー分のtop位置を調整 */}
      <div className="sticky top-16 z-40 flex items-center justify-between px-4 py-3 border-b bg-white/90 backdrop-blur-sm ml-2 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <h3 className="text-lg font-semibold text-gray-800">メモ・補足情報</h3>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="w-8 h-8 hover:bg-red-100 hover:text-red-600 transition-colors"
          title="パネルを閉じる"
        >
          <X size={16} />
        </Button>
      </div>

      {/* コンテンツエリア - ヘッダーとの重なりを防ぐため上部パディングを調整 */}
      <div className="flex-1 overflow-auto p-4 ml-2" style={{ paddingTop: '80px' }}>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ANALYTICS_COLUMNS.find(c => c.id === 'main_kw')?.label}
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              rows={2}
              value={form.main_kw}
              onChange={e => setForm(s => ({ ...s, main_kw: e.target.value }))}
              placeholder="主軸となるキーワードを入力"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ANALYTICS_COLUMNS.find(c => c.id === 'kw')?.label}
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              rows={2}
              value={form.kw}
              onChange={e => setForm(s => ({ ...s, kw: e.target.value }))}
              placeholder="参考キーワードを入力"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ANALYTICS_COLUMNS.find(c => c.id === 'impressions')?.label}
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              rows={2}
              value={form.impressions}
              onChange={e => setForm(s => ({ ...s, impressions: e.target.value }))}
              placeholder="表示回数や検索ボリュームの情報"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ANALYTICS_COLUMNS.find(c => c.id === 'needs')?.label}
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              rows={3}
              value={form.needs}
              onChange={e => setForm(s => ({ ...s, needs: e.target.value }))}
              placeholder="ユーザーのニーズや課題"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ANALYTICS_COLUMNS.find(c => c.id === 'persona')?.label}
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              rows={3}
              value={form.persona}
              onChange={e => setForm(s => ({ ...s, persona: e.target.value }))}
              placeholder="デモグラフィック情報やペルソナ"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ANALYTICS_COLUMNS.find(c => c.id === 'goal')?.label}
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              rows={3}
              value={form.goal}
              onChange={e => setForm(s => ({ ...s, goal: e.target.value }))}
              placeholder="達成したいゴールや目標"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ANALYTICS_COLUMNS.find(c => c.id === 'prep')?.label}
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              rows={3}
              value={form.prep}
              onChange={e => setForm(s => ({ ...s, prep: e.target.value }))}
              placeholder="PREP法の要点や伝えたい流れ"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ANALYTICS_COLUMNS.find(c => c.id === 'basic_structure')?.label}
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              rows={3}
              value={form.basic_structure}
              onChange={e => setForm(s => ({ ...s, basic_structure: e.target.value }))}
              placeholder="導入や見出し構成など基本的な流れ"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ANALYTICS_COLUMNS.find(c => c.id === 'opening_proposal')?.label}
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              rows={3}
              value={form.opening_proposal}
              onChange={e => setForm(s => ({ ...s, opening_proposal: e.target.value }))}
              placeholder="書き出しの方向性や冒頭で伝えたい内容"
            />
          </div>

          {/* WordPress連携設定 */}
          <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
            <h4 className="text-md font-semibold text-gray-800">WordPress連携</h4>
            <p className="text-sm text-gray-600">
              WordPressで公開されている記事URLを入力してください。カスタムパーマリンクにも対応し、
              URLから投稿IDを自動取得して連携します。空欄の場合は連携を解除します。
            </p>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700" htmlFor="wp-canonical-url">
                WordPress投稿URL（任意）
              </label>
              <input
                id="wp-canonical-url"
                type="text"
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={canonicalUrl}
                onChange={e => {
                  setCanonicalUrl(e.target.value);
                  if (canonicalUrlError) setCanonicalUrlError('');
                }}
                placeholder="例: https://example.com/article-title/"
              />
              {canonicalUrlError && (
                <p className="text-sm text-red-600">{canonicalUrlError}</p>
              )}
            </div>
          </div>

          {/* アクションボタン */}
          <div className="pt-4 border-t border-gray-200">
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={save}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  'メモを保存'
                )}
              </Button>

              {/* ボタン上のメッセージ */}
              {saveButtonMessage && (
                <div
                  className={`absolute -top-12 left-1/2 transform -translate-x-1/2 px-3 py-2 text-sm font-medium text-white rounded-lg shadow-lg z-50 whitespace-nowrap transition-all duration-300 ease-in-out ${
                    saveButtonMessageType === 'success' ? 'bg-green-600' : 'bg-red-600'
                  }`}
                >
                  {saveButtonMessage}
                  {/* 三角形（下向き） */}
                  <div
                    className={`absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent ${
                      saveButtonMessageType === 'success'
                        ? 'border-t-green-600'
                        : 'border-t-red-600'
                    }`}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
