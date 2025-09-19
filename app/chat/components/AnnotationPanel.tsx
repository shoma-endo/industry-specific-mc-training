'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  upsertContentAnnotationBySession,
  publishFromSession,
} from '@/server/handler/actions/wordpress.action';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ANALYTICS_COLUMNS } from '@/lib/constants';

type AnnotationData = {
  main_kw?: string;
  kw?: string;
  impressions?: string;
  persona?: string;
  needs?: string;
  goal?: string;
};

type Props = {
  sessionId: string;
  initialData?: AnnotationData | null;
  onClose: () => void;
  isVisible?: boolean;
};

export default function AnnotationPanel({
  sessionId,
  initialData,
  onClose,
  isVisible = true,
}: Props) {
  const [form, setForm] = React.useState({
    main_kw: '',
    kw: '',
    impressions: '',
    needs: '',
    persona: '',
    goal: '',
  });
  const [loading, setLoading] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [status, setStatus] = React.useState<'draft' | 'publish'>('draft');
  const [title, setTitle] = React.useState('');
  const [contentHtml, setContentHtml] = React.useState('');
  const [error, setError] = React.useState<string>('');
  const [saveButtonMessage, setSaveButtonMessage] = React.useState<string>('');
  const [saveButtonMessageType, setSaveButtonMessageType] = React.useState<
    'success' | 'error' | ''
  >('');
  const [publishButtonMessage, setPublishButtonMessage] = React.useState<string>('');
  const [publishButtonMessageType, setPublishButtonMessageType] = React.useState<
    'success' | 'error' | ''
  >('');

  // リサイザー機能のためのstate
  const [panelWidth, setPanelWidth] = useState(() => {
    // localStorage から保存された幅を復元（デフォルト: 450px）
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('annotation-panel-width');
      return saved ? parseInt(saved, 10) : 450;
    }
    return 450;
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartXRef = useRef<number>(0);
  const initialWidthRef = useRef<number>(0);

  React.useEffect(() => {
    if (initialData) {
      setForm({
        main_kw: initialData.main_kw ?? '',
        kw: initialData.kw ?? '',
        impressions: initialData.impressions ?? '',
        needs: initialData.needs ?? '',
        persona: initialData.persona ?? '',
        goal: initialData.goal ?? '',
      });
    } else {
      // 初期データがない場合は空のフォームにリセット
      setForm({
        main_kw: '',
        kw: '',
        impressions: '',
        needs: '',
        persona: '',
        goal: '',
      });
    }
  }, [initialData]);

  // 幅変更をlocalStorageに保存
  useEffect(() => {
    localStorage.setItem('annotation-panel-width', panelWidth.toString());
  }, [panelWidth]);

  // リサイザーのマウスイベントハンドラー
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsResizing(true);
      resizeStartXRef.current = e.clientX;
      initialWidthRef.current = panelWidth;
      e.preventDefault();
    },
    [panelWidth]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaX = resizeStartXRef.current - e.clientX; // 左にドラッグで拡大
      const newWidth = Math.max(320, Math.min(1000, initialWidthRef.current + deltaX)); // 320px-1000px の範囲
      setPanelWidth(newWidth);
    },
    [isResizing]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  // グローバルマウスイベントの管理
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // リサイズ中はカーソルを固定
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
    return () => {}; // falseの場合の空のcleanup関数
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const save = async () => {
    setLoading(true);
    setError('');
    setSaveButtonMessage('');
    try {
      const res = await upsertContentAnnotationBySession({ session_id: sessionId, ...form });
      if (!res.success) {
        // ボタン上にエラーメッセージを表示
        setSaveButtonMessage('保存に失敗しました');
        setSaveButtonMessageType('error');
        setTimeout(() => {
          setSaveButtonMessage('');
          setSaveButtonMessageType('');
        }, 3000);
      } else {
        // ボタン上に成功メッセージを表示
        setSaveButtonMessage('保存しました');
        setSaveButtonMessageType('success');
        setTimeout(() => {
          setSaveButtonMessage('');
          setSaveButtonMessageType('');
        }, 3000);
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

  const publish = async () => {
    setPublishing(true);
    setError('');
    setPublishButtonMessage('');
    setPublishButtonMessageType('');
    try {
      const res = await publishFromSession({
        session_id: sessionId,
        title: title || '（無題）',
        contentHtml: contentHtml || '',
        status,
      });
      if (!res.success) {
        setError(res.error || '公開に失敗しました');
        setPublishButtonMessage('公開に失敗しました');
        setPublishButtonMessageType('error');
        setTimeout(() => {
          setPublishButtonMessage('');
          setPublishButtonMessageType('');
        }, 3000);
      } else {
        const okMsg = status === 'publish' ? '公開しました' : '下書き保存しました';
        setPublishButtonMessage(okMsg);
        setPublishButtonMessageType('success');
        setTimeout(() => {
          setPublishButtonMessage('');
          setPublishButtonMessageType('');
        }, 3000);
      }
    } catch {
      setError('公開に失敗しました');
      setPublishButtonMessage('公開に失敗しました');
      setPublishButtonMessageType('error');
      setTimeout(() => {
        setPublishButtonMessage('');
        setPublishButtonMessageType('');
      }, 3000);
    } finally {
      setPublishing(false);
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
        {error && (
          <div className="mb-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            {error}
          </div>
        )}

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

          {/* WordPress公開設定 */}
          <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
            <h4 className="text-md font-semibold text-gray-800">WordPress公開設定</h4>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                タイトル（任意・WP送信用）
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="WordPressに投稿するタイトル"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                本文HTML（任意・WP送信用）
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono"
                rows={6}
                value={contentHtml}
                onChange={e => setContentHtml(e.target.value)}
                placeholder="WordPressに投稿するHTML内容"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">公開状態:</label>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={status}
                onChange={e => setStatus(e.target.value as 'draft' | 'publish')}
              >
                <option value="draft">下書き</option>
                <option value="publish">公開</option>
              </select>
            </div>
          </div>

          {/* アクションボタン */}
          <div className="mt-6 flex flex-col gap-3 pt-4 border-t border-gray-200">
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={save}
                disabled={loading || publishing}
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

            <div className="relative">
              <Button
                size="sm"
                onClick={publish}
                disabled={loading || publishing}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {publishing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    送信中...
                  </>
                ) : (
                  `WordPressに${status === 'publish' ? '公開' : '下書き保存'}`
                )}
              </Button>

              {publishButtonMessage && (
                <div
                  className={`absolute -top-12 left-1/2 transform -translate-x-1/2 px-3 py-2 text-sm font-medium text-white rounded-lg shadow-lg z-50 whitespace-nowrap transition-all duration-300 ease-in-out ${
                    publishButtonMessageType === 'success' ? 'bg-green-600' : 'bg-red-600'
                  }`}
                >
                  {publishButtonMessage}
                  <div
                    className={`absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent ${
                      publishButtonMessageType === 'success'
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
