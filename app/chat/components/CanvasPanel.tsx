'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Typography from '@tiptap/extension-typography';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { createLowlight } from 'lowlight';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Copy, Download, FileText, FileDown, ClipboardCheck } from 'lucide-react';

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

  // ✅ ボタンの参照を保持
  const markdownBtnRef = useRef<HTMLButtonElement>(null);
  const downloadBtnRef = useRef<HTMLButtonElement>(null);

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
    if (content) {
      const markdown = parseAsMarkdown(content);
      setMarkdownContent(markdown);

      if (editor) {
        // マークダウンをHTMLに変換してエディタに設定
        const htmlContent = markdown
          .replace(/^# (.*$)/gm, '<h1>$1</h1>')
          .replace(/^## (.*$)/gm, '<h2>$1</h2>')
          .replace(/^### (.*$)/gm, '<h3>$1</h3>')
          .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
          .replace(/^##### (.*$)/gm, '<h5>$1</h5>')
          .replace(/^###### (.*$)/gm, '<h6>$1</h6>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/`(.*?)`/g, '<code>$1</code>')
          .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
          .replace(/^- (.*$)/gm, '<li>$1</li>')
          .replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>')
          .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
          .replace(/\n/g, '<br>');

        editor.commands.setContent(htmlContent);
      }
    }
  }, [editor, content]);

  // ✅ 吹き出し表示関数
  const showBubble = (
    buttonRef: React.RefObject<HTMLButtonElement | null>,
    message: string,
    type: 'markdown' | 'text' | 'download'
  ) => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const containerRect = buttonRef.current.closest('.w-96')?.getBoundingClientRect();

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
    <div className="w-96 h-full bg-white border-l flex flex-col relative">
      {/* ✅ CSS吹き出し（サルワカデザイン） */}
      {bubble.isVisible && (
        <div
          className={`absolute z-50 px-3 py-2 text-sm font-medium text-white rounded-lg shadow-lg transition-all duration-300 ease-in-out transform ${
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

      {/* ヘッダー */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Canvas (マークダウン記事)</h2>
        <div className="flex items-center gap-2">
          <Button
            ref={markdownBtnRef}
            variant="ghost"
            size="icon"
            onClick={handleCopyMarkdown}
            className="w-8 h-8 hover:bg-green-100 hover:text-green-600 transition-colors"
            title="マークダウンとしてコピー"
          >
            <Copy size={16} />
          </Button>
          <Button
            ref={downloadBtnRef}
            variant="ghost"
            size="icon"
            onClick={handleDownloadMarkdown}
            className="w-8 h-8 hover:bg-purple-100 hover:text-purple-600 transition-colors"
            title="マークダウンファイルをダウンロード"
          >
            <Download size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="w-8 h-8 hover:bg-red-100 hover:text-red-600 transition-colors"
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      {/* コンテンツエリア */}
      <div className="flex-1 overflow-auto">
        <Card className="m-4 p-4">
          {content ? (
            <EditorContent
              editor={editor}
              className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded"
            />
          ) : (
            <div className="text-gray-500 text-center py-8">
              <FileText size={48} className="mx-auto mb-4 text-gray-300" />
              <p>AIの返信がマークダウン記事として</p>
              <p>ここに表示されます</p>
            </div>
          )}
        </Card>
      </div>

      {/* フッターアクション */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex gap-2 mb-2">
          <Button
            ref={markdownBtnRef}
            size="sm"
            variant="default"
            onClick={handleCopyMarkdown}
            className="flex-1 bg-green-600 hover:bg-green-700 transition-colors py-6"
          >
            <ClipboardCheck size={16} className="mr-1" />
            マークダウンコピー
          </Button>
          <Button
            ref={downloadBtnRef}
            size="sm"
            variant="outline"
            onClick={handleDownloadMarkdown}
            className="flex-1 hover:bg-purple-50 hover:border-purple-300 transition-colors py-6"
          >
            <FileDown size={16} className="mr-1" />
            .mdファイル
            <br />
            ダウンロード
          </Button>
        </div>
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
