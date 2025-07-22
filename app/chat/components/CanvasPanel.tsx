'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Typography } from '@tiptap/extension-typography';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { createLowlight } from 'lowlight';
import { X, ClipboardCheck, FileDown, List } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CanvasPanelProps {
  onClose: () => void;
  content?: string; // AIからの返信内容
  isVisible?: boolean;
}

// ✅ 吹き出し状態の管理
interface BubbleState {
  isVisible: boolean;
  message: string;
  type: 'markdown' | 'text' | 'download';
  position: { top: number; left: number };
}

// ✅ 見出し情報の型定義
interface HeadingItem {
  level: number; // 1-6 (H1-H6)
  text: string;
  id: string;
}

// ✅ lowlightインスタンスを作成
const lowlight = createLowlight();

// ✅ プレーンテキストからマークダウンへの変換
const parseAsMarkdown = (text: string): string => {
  if (!text) return '';

  // AIの返信をマークダウンとして解釈
  return text
    .split('\n')
    .map(line => {
      const trimmed = line.trim();

      // 見出しの検出
      if (trimmed.match(/^#+\s/)) return line;
      if (trimmed.match(/^[0-9]+\.\s/)) return line;
      if (trimmed.match(/^[-*]\s/)) return line;

      // コードブロックの検出
      if (trimmed.startsWith('```')) return line;

      // リストアイテムの変換
      if (trimmed.match(/^・\s/)) return line.replace(/^・\s/, '- ');
      if (trimmed.match(/^[0-9]+\.\s/)) return line;

      // 強調の変換
      if (trimmed.includes('**')) return line;

      return line;
    })
    .join('\n');
};

const CanvasPanel: React.FC<CanvasPanelProps> = ({ onClose, content = '', isVisible = true }) => {
  const [markdownContent, setMarkdownContent] = useState('');
  const [bubble, setBubble] = useState<BubbleState>({
    isVisible: false,
    message: '',
    type: 'markdown',
    position: { top: 0, left: 0 },
  });

  // ✅ アウトラインパネル用のstate
  const [outlineVisible, setOutlineVisible] = useState(false);
  const [headings, setHeadings] = useState<HeadingItem[]>([]);

  // ✅ リサイザー機能のためのstate
  const [canvasWidth, setCanvasWidth] = useState(() => {
    // localStorage から保存された幅を復元（デフォルト: 450px）
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('canvas-width');
      return saved ? parseInt(saved, 10) : 450;
    }
    return 450;
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartXRef = useRef<number>(0);
  const initialWidthRef = useRef<number>(0);

  // ✅ ボタンの参照を保持
  const markdownBtnRef = useRef<HTMLButtonElement>(null);
  const downloadBtnRef = useRef<HTMLButtonElement>(null);

  // ✅ 見出しIDを生成する関数
  const generateHeadingId = useCallback((text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }, []);

  // ✅ マークダウンから見出しを抽出する関数
  const extractHeadings = useCallback(
    (markdown: string): HeadingItem[] => {
      const lines = markdown.split('\n');
      const headingItems: HeadingItem[] = [];

      lines.forEach((line, index) => {
        const trimmed = line.trim();
        const match = trimmed.match(/^(#{1,6})\s+(.+)$/);

        if (match && match[1] && match[2]) {
          const level = match[1].length;
          const text = match[2];
          const id = `heading-${index}-${generateHeadingId(text)}`;

          headingItems.push({ level, text, id });
        }
      });

      return headingItems;
    },
    [generateHeadingId]
  );

  // ✅ 幅変更をlocalStorageに保存
  useEffect(() => {
    localStorage.setItem('canvas-width', canvasWidth.toString());
  }, [canvasWidth]);

  // ✅ リサイザーのマウスイベントハンドラー
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsResizing(true);
      resizeStartXRef.current = e.clientX;
      initialWidthRef.current = canvasWidth;
      e.preventDefault();
    },
    [canvasWidth]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaX = resizeStartXRef.current - e.clientX; // 左にドラッグで拡大
      const newWidth = Math.max(320, Math.min(1000, initialWidthRef.current + deltaX)); // 320px-1000px の範囲
      setCanvasWidth(newWidth);
    },
    [isResizing]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  // ✅ グローバルマウスイベントの管理
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

  // ✅ マークダウン対応TipTapエディタ
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // lowlightのCodeBlockを使うため無効化
      }),
      Typography, // タイポグラフィ拡張
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'javascript',
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: '',
    editable: false, // 読み取り専用
    immediatelyRender: false,
  });

  // ✅ コンテンツが更新された時の処理
  useEffect(() => {
    console.log('🔄 CanvasPanel - content updated:', !!content);
    if (content) {
      const markdown = parseAsMarkdown(content);
      setMarkdownContent(markdown);

      // ✅ 見出しを抽出
      const extractedHeadings = extractHeadings(markdown);
      console.log('📝 Extracted headings:', extractedHeadings);
      setHeadings(extractedHeadings);

      if (editor) {
        // マークダウンをHTMLに変換してエディタに設定
        let htmlContent = markdown
          .replace(/^# (.*$)/gm, '<h1 id="heading-$1">$1</h1>')
          .replace(/^## (.*$)/gm, '<h2 id="heading-$1">$1</h2>')
          .replace(/^### (.*$)/gm, '<h3 id="heading-$1">$1</h3>')
          .replace(/^#### (.*$)/gm, '<h4 id="heading-$1">$1</h4>')
          .replace(/^##### (.*$)/gm, '<h5 id="heading-$1">$1</h5>')
          .replace(/^###### (.*$)/gm, '<h6 id="heading-$1">$1</h6>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/`(.*?)`/g, '<code>$1</code>')
          .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
          .replace(/^- (.*$)/gm, '<li>$1</li>')
          .replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>')
          .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
          .replace(/\n/g, '<br>');

        // 見出しIDを適切に設定
        extractedHeadings.forEach(heading => {
          const regex = new RegExp(
            `<h${heading.level} id="heading-[^"]*">${heading.text}</h${heading.level}>`,
            'g'
          );
          htmlContent = htmlContent.replace(
            regex,
            `<h${heading.level} id="${heading.id}">${heading.text}</h${heading.level}>`
          );
        });

        editor.commands.setContent(htmlContent);
      }
    }
  }, [editor, content, extractHeadings]);

  // ✅ 見出しクリック時のスクロール機能
  const handleHeadingClick = (headingId: string) => {
    const element = document.getElementById(headingId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // ✅ 吹き出し表示関数
  const showBubble = (
    buttonRef: React.RefObject<HTMLButtonElement | null>,
    message: string,
    type: 'markdown' | 'text' | 'download'
  ) => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const containerRect = buttonRef.current.closest('.canvas-panel')?.getBoundingClientRect();

      if (containerRect) {
        // コンテナ内での相対位置を計算
        const relativeTop = rect.top - containerRect.top - 60; // 吹き出しの高さ分上に表示
        const relativeLeft = rect.left - containerRect.left + rect.width / 2 - 75; // 中央揃え

        setBubble({
          isVisible: true,
          message,
          type,
          position: { top: relativeTop, left: relativeLeft },
        });

        // 3秒後に自動で消す
        setTimeout(() => {
          setBubble(prev => ({ ...prev, isVisible: false }));
        }, 3000);
      }
    }
  };

  // ✅ マークダウンとしてコピー（CSS吹き出しのみ）
  const handleCopyMarkdown = async () => {
    if (markdownContent) {
      try {
        await navigator.clipboard.writeText(markdownContent);
        showBubble(markdownBtnRef, '📝 マークダウンを\nコピーしました！', 'markdown');
      } catch (error) {
        console.error('マークダウンコピーエラー:', error);
        showBubble(markdownBtnRef, '❌ コピーに\n失敗しました', 'markdown');
      }
    }
  };

  // ✅ マークダウンファイルとしてダウンロード（CSS吹き出しのみ）
  const handleDownloadMarkdown = () => {
    if (markdownContent) {
      try {
        const blob = new Blob([markdownContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const fileName = `article-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.md`;
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('ファイルダウンロードエラー:', error);
      }
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className="canvas-panel h-full bg-white border-l flex flex-col relative"
      style={{ width: canvasWidth }}
    >
      {/* ✅ リサイザーハンドル - 固定ヘッダー下から開始 */}
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

      {/* ✅ CSS吹き出し（サルワカデザイン） - 最上位に表示 */}
      {bubble.isVisible && (
        <div
          className={`absolute z-[60] px-3 py-2 text-sm font-medium text-white rounded-lg shadow-lg transition-all duration-300 ease-in-out transform ${
            bubble.type === 'markdown'
              ? 'bg-green-600'
              : bubble.type === 'text'
                ? 'bg-blue-600'
                : 'bg-purple-600'
          } animate-bounce-in`}
          style={{
            top: `${bubble.position.top}px`,
            left: `${bubble.position.left}px`,
            minWidth: '150px',
            textAlign: 'center',
            whiteSpace: 'pre-line',
          }}
        >
          {bubble.message}
          {/* ✅ 三角形（下向き）- サルワカスタイル */}
          <div
            className={`absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[8px] border-l-transparent border-r-transparent ${
              bubble.type === 'markdown'
                ? 'border-t-green-600'
                : bubble.type === 'text'
                  ? 'border-t-blue-600'
                  : 'border-t-purple-600'
            }`}
          />
        </div>
      )}

      {/* ヘッダー部分 - 固定ヘッダー分のtop位置を調整 */}
      <div className="sticky top-16 z-40 flex items-center justify-between p-4 border-b bg-gray-50 ml-2 shadow-sm">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-800">Canvas (マークダウン記事)</h3>
          {headings.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                console.log('🎛️ Toggle outline:', !outlineVisible, 'headings:', headings.length);
                setOutlineVisible(!outlineVisible);
              }}
              className={`w-8 h-8 transition-colors ${
                outlineVisible ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' : 'hover:bg-gray-200'
              }`}
              title="アウトライン表示切り替え"
            >
              <List size={16} />
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            ref={markdownBtnRef}
            size="sm"
            variant="default"
            onClick={handleCopyMarkdown}
            className="bg-green-600 hover:bg-green-700 transition-colors px-3 py-1 text-xs"
            title="マークダウンとしてコピー"
          >
            <ClipboardCheck size={14} className="mr-1" />
            コピー
          </Button>
          <Button
            ref={downloadBtnRef}
            size="sm"
            variant="outline"
            onClick={handleDownloadMarkdown}
            className="hover:bg-purple-50 hover:border-purple-300 transition-colors px-3 py-1 text-xs"
            title="マークダウンファイルをダウンロード"
          >
            <FileDown size={14} className="mr-1" />
            .md
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="w-8 h-8 hover:bg-red-100 hover:text-red-600 transition-colors"
            title="Canvasを閉じる"
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      {/* ✅ アウトラインパネル - ヘッダー下の適切な位置に配置 */}
      {(() => {
        const shouldShow = outlineVisible && headings.length > 0;
        console.log('📋 Outline panel display:', {
          outlineVisible,
          headingsCount: headings.length,
          shouldShow,
        });
        return shouldShow;
      })() && (
        <div className="sticky top-32 z-30 border-b bg-gray-50 ml-2 max-h-48 overflow-y-auto shadow-sm">
          <div className="p-3">
            <h4 className="text-sm font-medium text-gray-600 mb-2">アウトライン</h4>
            <div className="space-y-1">
              {headings.map((heading, index) => (
                <button
                  key={index}
                  onClick={() => {
                    console.log('🔗 Heading clicked:', heading.id, heading.text);
                    handleHeadingClick(heading.id);
                  }}
                  className={`block w-full text-left text-sm hover:bg-gray-200 rounded px-2 py-1 transition-colors ${
                    heading.level === 1
                      ? 'font-semibold text-gray-900'
                      : heading.level === 2
                        ? 'font-medium text-gray-800 pl-4'
                        : heading.level === 3
                          ? 'text-gray-700 pl-6'
                          : heading.level === 4
                            ? 'text-gray-600 pl-8'
                            : heading.level === 5
                              ? 'text-gray-500 pl-10'
                              : 'text-gray-400 pl-12'
                  }`}
                  title={heading.text}
                >
                  {heading.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* エディタエリア - 固定ヘッダー分の十分なpadding-topを確保 */}
      <div className="flex-1 overflow-auto ml-2 pt-20">
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded"
        />
      </div>


      {/* ✅ CSSアニメーション */}
      <style jsx>{`
        .animate-bounce-in {
          animation: bounceIn 0.3s ease-out;
        }

        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale(0.3) translateY(-10px);
          }
          50% {
            opacity: 1;
            transform: scale(1.1) translateY(0);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default CanvasPanel;
