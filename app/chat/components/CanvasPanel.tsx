'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Typography } from '@tiptap/extension-typography';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { Placeholder } from '@tiptap/extension-placeholder';
import { createLowlight } from 'lowlight';
import { DOMSerializer } from 'prosemirror-model';
import {
  X,
  ClipboardCheck,
  FileDown,
  List,
  Edit3,
  Save,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface CanvasSelectionEditPayload {
  instruction: string;
  selectedText: string;
  selectedHtml?: string;
  action: 'improve' | 'explain';
}

export interface CanvasSelectionEditResult {
  replacementHtml: string;
  explanation?: string;
}

interface CanvasPanelProps {
  onClose: () => void;
  content?: string; // AIからの返信内容
  isVisible?: boolean;
  onSelectionEdit?: (payload: CanvasSelectionEditPayload) => Promise<CanvasSelectionEditResult>;
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

interface SelectionState {
  from: number;
  to: number;
  text: string;
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

const DEFAULT_EXPLANATION_PROMPT = 'このセクションについて詳しく説明していただけますか？';
const MENU_SIZE = {
  menu: { width: 120, height: 40 },
  input: { width: 260, height: 190 },
} as const;

const CanvasPanel: React.FC<CanvasPanelProps> = ({
  onClose,
  content = '',
  isVisible = true,
  onSelectionEdit,
}) => {
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

  // ✅ Claude web版Canvas同様の編集機能
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState('');

  // ✅ 選択範囲編集用のstate
  const [selectionState, setSelectionState] = useState<SelectionState | null>(null);
  const selectionSnapshotRef = useRef<SelectionState | null>(null);
  const [instruction, setInstruction] = useState('');
  const [isApplyingSelectionEdit, setIsApplyingSelectionEdit] = useState(false);
  const [selectionMode, setSelectionMode] = useState<'menu' | 'input' | null>(null);
  const [selectionAction, setSelectionAction] = useState<'improve' | 'explain' | null>(null);
  const [selectionMenuPosition, setSelectionMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [lastAiExplanation, setLastAiExplanation] = useState<string | null>(null);
  const [lastAiError, setLastAiError] = useState<string | null>(null);
  const activeSelection = useMemo(
    () => selectionState ?? selectionSnapshotRef.current,
    [selectionState]
  );
  const selectionPreview = useMemo(() => {
    if (!activeSelection) return '';
    const trimmed = activeSelection.text.replace(/\s+/g, ' ').trim();
    return trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed;
  }, [activeSelection]);

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
  const saveBtnRef = useRef<HTMLButtonElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectionAnchorRef = useRef<{ top: number; left: number } | null>(null);

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

  const updateSelectionMenuPosition = useCallback(
    (modeOverride?: 'menu' | 'input', anchorOverride?: { top: number; left: number } | null) => {
      const container = scrollContainerRef.current;
      if (!container) return;

      let anchor = anchorOverride ?? selectionAnchorRef.current;

      if (!anchor) {
        const selection = typeof window !== 'undefined' ? window.getSelection() : null;
        if (!selection || selection.rangeCount === 0) {
          setSelectionMenuPosition(null);
          return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        anchor = {
          top: rect.top - containerRect.top + container.scrollTop,
          left: rect.right - containerRect.left + container.scrollLeft + 12,
        };
        selectionAnchorRef.current = anchor;
      }

      const { top: anchorTop, left: anchorLeft } = anchor;
      const scrollTop = container.scrollTop;
      const scrollLeft = container.scrollLeft;
      const mode = modeOverride ?? selectionMode ?? 'menu';
      const size = MENU_SIZE[mode];

      const minTop = scrollTop + 8;
      const minLeft = scrollLeft + 8;
      const maxLeft = scrollLeft + container.clientWidth - size.width - 8;

      const top = Math.max(anchorTop, minTop);
      const left = Math.min(Math.max(anchorLeft, minLeft), Math.max(minLeft, maxLeft));

      if (Number.isFinite(top) && Number.isFinite(left)) {
        setSelectionMenuPosition({ top, left });
      }
    },
    [selectionMode]
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

  // ✅ Claude web版Canvas同様のマークダウン対応TipTapエディタ
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
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline hover:text-blue-800',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded',
        },
      }),
      Color,
      TextStyle,
      Highlight.configure({
        multicolor: true,
      }),
      Placeholder.configure({
        placeholder: 'ここでマークダウンを編集できます...',
      }),
    ],
    content: '',
    editable: isEditing, // 編集モード切り替え対応
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      // Claude web版同様のリアルタイム更新検知
      const newContent = editor.getHTML();
      if (newContent !== lastSavedContent) {
        setHasUnsavedChanges(true);
      }
    },
  });

  // ✅ 選択範囲の監視（Canvas AI編集用）
  useEffect(() => {
    if (!editor || !onSelectionEdit) return;

    const handleSelectionUpdate = () => {
      const { from, to } = editor.state.selection;
      const domSelection = typeof window !== 'undefined' ? window.getSelection() : null;

      const container = scrollContainerRef.current;
      if (from === to || !domSelection || domSelection.isCollapsed || !container) {
        setSelectionState(null);
        selectionSnapshotRef.current = null;
        setSelectionMode(null);
        setSelectionAction(null);
        setSelectionMenuPosition(null);
        setInstruction('');
        selectionAnchorRef.current = null;
        return;
      }

      const text = editor.state.doc.textBetween(from, to, '\n', '\n').trim();
      if (!text) {
        setSelectionState(null);
        selectionSnapshotRef.current = null;
        setSelectionMode(null);
        setSelectionAction(null);
        setSelectionMenuPosition(null);
        setInstruction('');
        selectionAnchorRef.current = null;
        return;
      }

      const range = domSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const anchor = {
        top: rect.top - containerRect.top + container.scrollTop,
        left: rect.right - containerRect.left + container.scrollLeft + 12,
      };

      const nextState: SelectionState = { from, to, text };
      setSelectionState(nextState);
      selectionSnapshotRef.current = nextState;
      selectionAnchorRef.current = anchor;
      setSelectionMode('menu');
      setSelectionAction(null);
      setInstruction('');
      setLastAiError(null);
      updateSelectionMenuPosition('menu', anchor);
    };

    editor.on('selectionUpdate', handleSelectionUpdate);
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor, onSelectionEdit, updateSelectionMenuPosition]);

  useEffect(() => {
    if (!selectionMode) return;

    const handle = () => updateSelectionMenuPosition(selectionMode);
    const scrollEl = scrollContainerRef.current;

    window.addEventListener('resize', handle);
    scrollEl?.addEventListener('scroll', handle);

    return () => {
      window.removeEventListener('resize', handle);
      scrollEl?.removeEventListener('scroll', handle);
    };
  }, [selectionMode, updateSelectionMenuPosition]);

  useEffect(() => {
    if (selectionMode) {
      updateSelectionMenuPosition(selectionMode);
    }
  }, [selectionMode, updateSelectionMenuPosition]);

  // ✅ コンテンツが更新された時の処理
  useEffect(() => {
    if (content) {
      const markdown = parseAsMarkdown(content);
      setMarkdownContent(markdown);

      // ✅ 見出しを抽出
      const extractedHeadings = extractHeadings(markdown);
      setHeadings(extractedHeadings);

      if (editor) {
        // ChatGPT風マークダウンをHTMLに変換してエディタに設定
        // ✅ 見出しIDの一貫性を保つために、行インデックスを使用してHTMLに変換
        const lines = markdown.split('\n');
        let htmlContent = markdown;
        
        // 見出し処理をインデックス付きで実行
        lines.forEach((line, index) => {
          const trimmed = line.trim();
          const match = trimmed.match(/^(#{1,6})\s+(.+)$/);
          
          if (match && match[1] && match[2]) {
            const level = match[1].length;
            const text = match[2];
            const id = `heading-${index}-${generateHeadingId(text)}`;
            const tagName = `h${level}`;
            const replacement = `<${tagName} id="${id}">${text}</${tagName}>`;
            
            // 元の行を置換
            htmlContent = htmlContent.replace(line, replacement);
          }
        });
        
        // その他のマークダウン要素を処理
        htmlContent = htmlContent
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/`(.*?)`/g, '<code>$1</code>')
          .replace(/```([\s\S]*?)\n```/g, '<pre><code>$1</code></pre>')
          // ChatGPT風リスト処理 - 改行を考慮
          .split('\n')
          .map(line => {
            // チェックマーク付きリスト
            if (line.match(/^[✅✓☑️]\s/)) {
              return `<p class="checklist-item">${line}</p>`;
            }
            // 通常のリスト
            if (line.match(/^[-*]\s/)) {
              return `<li>${line.replace(/^[-*]\s/, '')}</li>`;
            }
            // 番号付きリスト
            if (line.match(/^\d+\.\s/)) {
              return `<li>${line.replace(/^\d+\.\s/, '')}</li>`;
            }
            // 空行
            if (line.trim() === '') {
              return '<br>';
            }
            // 通常の段落
            if (!line.match(/^[#<]/)) {
              return `<p>${line}</p>`;
            }
            return line;
          })
          .join('\n')
          // 連続するliをulで囲む
          .replace(/(<li>.*?<\/li>\n?)+/g, '<ul>$&</ul>')
          // 不要なbrタグを整理
          .replace(/<br>\n?<br>/g, '<br>');

        // 見出しIDは既に正しく設定されているため、この処理は不要

        editor.commands.setContent(htmlContent);
        setLastSavedContent(htmlContent);
        setHasUnsavedChanges(false);
      }
    }
  }, [editor, content, extractHeadings, generateHeadingId]);

  useEffect(() => {
    setSelectionMode(null);
    setSelectionAction(null);
    setSelectionState(null);
    selectionSnapshotRef.current = null;
    setSelectionMenuPosition(null);
    setInstruction('');
    setLastAiError(null);
    selectionAnchorRef.current = null;
  }, [content]);

  useEffect(() => {
    if (lastAiError && instruction.trim().length > 0) {
      setLastAiError(null);
    }
  }, [instruction, lastAiError]);

  // ✅ Claude web版Canvas同様の編集機能
  const handleToggleEdit = useCallback(() => {
    if (isEditing && hasUnsavedChanges) {
      // 未保存の変更がある場合の警告
      const confirm = window.confirm('未保存の変更があります。編集を終了しますか？');
      if (!confirm) return;
    }

    setIsEditing(!isEditing);
    if (editor) {
      editor.setEditable(!isEditing);
    }
  }, [isEditing, hasUnsavedChanges, editor]);

  // ✅ HTMLからマークダウンへの変換（Claude web版同様）
  const convertHtmlToMarkdown = useCallback((html: string): string => {
    return html
      .replace(/<h1[^>]*>(.*?)<\/h1>/g, '# $1')
      .replace(/<h2[^>]*>(.*?)<\/h2>/g, '## $1')
      .replace(/<h3[^>]*>(.*?)<\/h3>/g, '### $1')
      .replace(/<h4[^>]*>(.*?)<\/h4>/g, '#### $1')
      .replace(/<h5[^>]*>(.*?)<\/h5>/g, '##### $1')
      .replace(/<h6[^>]*>(.*?)<\/h6>/g, '###### $1')
      .replace(/<strong[^>]*>(.*?)<\/strong>/g, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/g, '*$1*')
      .replace(/<code[^>]*>(.*?)<\/code>/g, '`$1`')
      .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/g, '```\n$1\n```')
      .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/g, (match, content) => {
        return content.replace(/<li[^>]*>(.*?)<\/li>/g, '- $1\n');
      })
      .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/g, (match, content) => {
        let counter = 1;
        return content.replace(/<li[^>]*>(.*?)<\/li>/g, () => `${counter++}. $1\n`);
      })
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, '[$2]($1)')
      .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/g, '![$2]($1)')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<p[^>]*>(.*?)<\/p>/g, '$1\n\n')
      .replace(/\n\n+/g, '\n\n')
      .trim();
  }, []);

  const getSelectionHtml = useCallback(
    (selection: SelectionState): string => {
      if (!editor) return selection.text;
      try {
        const fragment = editor.state.doc.cut(selection.from, selection.to).content;
        const serializer = DOMSerializer.fromSchema(editor.schema);
        const container = document.createElement('div');
        const serialized = serializer.serializeFragment(fragment, { document });
        container.appendChild(serialized);
        return container.innerHTML;
      } catch (error) {
        console.error('Failed to serialize selection:', error);
        return selection.text;
      }
    },
    [editor]
  );

  // ✅ 吹き出し表示関数
  const showBubble = useCallback(
    (
      buttonRef: React.RefObject<HTMLButtonElement | null>,
      message: string,
      type: 'markdown' | 'text' | 'download'
    ) => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const containerRect =
          buttonRef.current.closest('.canvas-panel')?.getBoundingClientRect();

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
    },
    []
  );

  const handleCancelSelectionPanel = useCallback(() => {
    if (selectionMode === 'input') {
      setSelectionMode('menu');
      setSelectionAction(null);
      setInstruction('');
      setLastAiError(null);
      updateSelectionMenuPosition('menu');
      return;
    }

    setSelectionMode(null);
    setSelectionAction(null);
    setSelectionState(null);
    selectionSnapshotRef.current = null;
    setSelectionMenuPosition(null);
    setInstruction('');
    setLastAiError(null);
    selectionAnchorRef.current = null;
  }, [selectionMode, updateSelectionMenuPosition]);

  const handleApplySelectionEdit = useCallback(async () => {
    if (!editor || !onSelectionEdit) return;
    const selection = activeSelection;
    if (!selection) {
      setLastAiError('編集対象の選択範囲が見つかりませんでした');
      return;
    }

    if (!selectionAction) {
      setLastAiError('改善または説明を選択してください');
      return;
    }

    const trimmedInstruction = instruction.trim();
    if (!trimmedInstruction) {
      setLastAiError('指示を入力してください');
      return;
    }

    setIsApplyingSelectionEdit(true);
    setLastAiError(null);

    try {
      if (!isEditing) {
        setIsEditing(true);
        editor.setEditable(true);
      }

      const selectionHtml = getSelectionHtml(selection).slice(0, 6000);

      const result = await onSelectionEdit({
        instruction: trimmedInstruction,
        selectedText: selection.text,
        selectedHtml: selectionHtml,
        action: selectionAction,
      });

      if (!result || !result.replacementHtml) {
        throw new Error('AIの応答に replacementHtml が含まれていません');
      }

      editor
        .chain()
        .focus()
        .insertContentAt({ from: selection.from, to: selection.to }, result.replacementHtml)
        .run();

      const html = editor.getHTML();
      const markdownFromHtml = convertHtmlToMarkdown(html);
      setMarkdownContent(markdownFromHtml);
      setHasUnsavedChanges(true);
      const explanation = (result.explanation ?? '').trim();
      setLastAiExplanation(explanation || null);
      setLastAiError(null);
      setSelectionMode(null);
      setSelectionAction(null);
      setSelectionState(null);
      selectionSnapshotRef.current = null;
      setSelectionMenuPosition(null);
      setInstruction('');
      selectionAnchorRef.current = null;
      const domSelection = typeof window !== 'undefined' ? window.getSelection() : null;
      domSelection?.removeAllRanges();
      showBubble(saveBtnRef, '✨ AIで編集しました', 'text');
    } catch (error) {
      console.error('Canvas selection edit failed:', error);
      const message =
        error instanceof Error ? error.message : 'AIによる編集の適用に失敗しました';
      setLastAiError(message);
    } finally {
      setIsApplyingSelectionEdit(false);
    }
  }, [
    activeSelection,
    convertHtmlToMarkdown,
    editor,
    getSelectionHtml,
    instruction,
    isEditing,
    selectionAction,
    onSelectionEdit,
    showBubble,
  ]);

  const handleSaveChanges = useCallback(() => {
    if (editor) {
      const currentContent = editor.getHTML();
      setLastSavedContent(currentContent);
      setHasUnsavedChanges(false);

      // マークダウンに変換して保存
      const markdownFromHtml = convertHtmlToMarkdown(currentContent);
      setMarkdownContent(markdownFromHtml);

      showBubble(saveBtnRef, '💾 変更を\n保存しました', 'markdown');
    }
  }, [editor, convertHtmlToMarkdown, showBubble]);

  const handleRevertChanges = useCallback(() => {
    if (editor && lastSavedContent) {
      editor.commands.setContent(lastSavedContent);
      setHasUnsavedChanges(false);
      // 吹き出しは削除
    }
  }, [editor, lastSavedContent]);

  // ✅ 見出しクリック時のスクロール機能
  const handleHeadingClick = (headingId: string) => {
    setTimeout(() => {
      const possibleSelectors = ['.ProseMirror', '[data-tippy-root] .ProseMirror', '.canvas-panel .ProseMirror'];
      let editorElement: Element | null = null;
      
      for (const selector of possibleSelectors) {
        editorElement = document.querySelector(selector);
        if (editorElement) break;
      }
      
      if (editorElement) {
        let element = editorElement.querySelector(`#${headingId}`);
        
        if (!element) {
          const targetHeading = headings.find(h => h.id === headingId);
          if (targetHeading) {
            const allHeadings = editorElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
            element = Array.from(allHeadings).find(h => 
              h.textContent?.trim() === targetHeading.text.trim()
            ) || null;
          }
        }
        
        if (element) {
          const canvasScrollContainer = document.querySelector('.canvas-panel .flex-1.overflow-auto');
          
          if (canvasScrollContainer) {
            const containerRect = canvasScrollContainer.getBoundingClientRect();
            const elementRect = element.getBoundingClientRect();
            const currentScrollTop = canvasScrollContainer.scrollTop;
            const targetScrollTop = currentScrollTop + (elementRect.top - containerRect.top) - 120;
            
            canvasScrollContainer.scrollTo({
              top: Math.max(0, targetScrollTop),
              behavior: 'smooth'
            });
          } else {
            element.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start',
              inline: 'nearest'
            });
          }
        }
      }
    }, 100);
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
      className="canvas-panel h-full bg-gray-50 border-l flex flex-col relative"
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
            minHeight: '48px',
            textAlign: 'center',
            whiteSpace: 'pre-line',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
      <div className="sticky top-16 z-40 flex items-center justify-between p-4 border-b bg-white/90 backdrop-blur-sm ml-2 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <h3 className="text-lg font-semibold text-gray-800">Canvas</h3>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              マークダウン記事
            </span>
          </div>
          {headings.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOutlineVisible(!outlineVisible)}
              className={`w-8 h-8 transition-all duration-200 ${
                outlineVisible
                  ? 'bg-blue-100 text-blue-600 hover:bg-blue-200 shadow-sm'
                  : 'hover:bg-gray-200'
              }`}
              title="アウトライン表示切り替え"
            >
              <List size={16} />
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          {/* Claude web版Canvas同様の編集ボタン */}
          <Button
            size="sm"
            variant={isEditing ? 'default' : 'outline'}
            onClick={handleToggleEdit}
            className={cn(
              'px-3 py-1 text-xs transition-colors',
              isEditing
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'hover:bg-blue-50 hover:border-blue-300'
            )}
            title={isEditing ? '編集を終了' : '編集を開始'}
          >
            <Edit3 size={14} className="mr-1" />
            {isEditing ? '完了' : '編集'}
          </Button>

          {/* 編集モード時の保存・元に戻すボタン */}
          {isEditing && (
            <>
              <Button
                ref={saveBtnRef}
                size="sm"
                variant="default"
                onClick={handleSaveChanges}
                disabled={!hasUnsavedChanges}
                className="bg-green-600 hover:bg-green-700 px-3 py-1 text-xs"
                title="変更を保存"
              >
                <Save size={14} className="mr-1" />
                保存
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRevertChanges}
                disabled={!hasUnsavedChanges}
                className="hover:bg-orange-50 hover:border-orange-300 px-3 py-1 text-xs"
                title="変更を元に戻す"
              >
                <RefreshCw size={14} className="mr-1" />
                元に戻す
              </Button>
            </>
          )}

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
      {outlineVisible && headings.length > 0 && (
        <div className="sticky top-32 z-30 border-b bg-white ml-2 max-h-48 overflow-y-auto shadow-sm">
          <div className="p-3">
            <h4 className="text-sm font-medium text-gray-600 mb-2">アウトライン</h4>
            <div className="space-y-1">
              {headings.map((heading, index) => (
                <button
                  key={index}
                  onClick={() => handleHeadingClick(heading.id)}
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

      {/* エディタエリア - ChatGPT風Canvas同様のスタイル */}
      <div className="flex-1 overflow-auto ml-2 pt-20 relative" ref={scrollContainerRef}>
        {onSelectionEdit && selectionMode && selectionMenuPosition && (
          <div
            className="absolute z-50 max-w-xs"
            style={{ top: selectionMenuPosition.top, left: selectionMenuPosition.left }}
          >
            {selectionMode === 'menu' ? (
              <div className="flex items-center gap-1 rounded-md border border-gray-300 bg-white/95 px-2 py-1 shadow-sm">
                <button
                  type="button"
                  className="rounded px-2 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
                  onClick={() => {
                    setSelectionMode('input');
                    setSelectionAction('improve');
                    setInstruction('');
                    setLastAiError(null);
                    updateSelectionMenuPosition('input');
                  }}
                >
                  改善
                </button>
                <span className="h-4 w-px bg-gray-300" aria-hidden="true" />
                <button
                  type="button"
                  className="rounded px-2 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
                  onClick={() => {
                    setSelectionMode('input');
                    setSelectionAction('explain');
                    setInstruction(DEFAULT_EXPLANATION_PROMPT);
                    setLastAiError(null);
                    updateSelectionMenuPosition('input');
                  }}
                >
                  説明
                </button>
              </div>
            ) : (
              <div className="w-64 rounded-md border border-gray-300 bg-white/95 p-3 shadow-sm">
                {selectionPreview && (
                  <p className="mb-2 line-clamp-2 text-xs text-gray-500">{selectionPreview}</p>
                )}
                <textarea
                  className="h-20 w-full resize-none rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  value={instruction}
                  onChange={event => setInstruction(event.target.value)}
                  placeholder={
                    selectionAction === 'explain'
                      ? DEFAULT_EXPLANATION_PROMPT
                      : 'どのように改善したいか入力してください'
                  }
                  disabled={isApplyingSelectionEdit}
                  autoFocus
                />
                {lastAiError && (
                  <p className="mt-2 text-xs text-red-600">{lastAiError}</p>
                )}
                <div className="mt-3 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelSelectionPanel}
                    disabled={isApplyingSelectionEdit}
                    className="h-7 px-3 text-xs"
                  >
                    キャンセル
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={handleApplySelectionEdit}
                    disabled={isApplyingSelectionEdit || instruction.trim().length === 0}
                  >
                    {isApplyingSelectionEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '送信'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div
          className={cn(
            'relative min-h-full p-8 bg-white rounded-lg shadow-sm mx-4 my-4 transition-all duration-300',
            isEditing && [
              'border border-dashed border-blue-300',
              'bg-white',
            ]
          )}
        >
          <EditorContent
            editor={editor}
            className={cn(
              'prose prose-lg max-w-none transition-all duration-200',
              // ChatGPT風の見出しスタイル
              'prose-h1:text-3xl prose-h1:font-bold prose-h1:text-center prose-h1:text-gray-900 prose-h1:mb-6 prose-h1:mt-8',
              'prose-h2:text-2xl prose-h2:font-semibold prose-h2:text-gray-800 prose-h2:mb-4 prose-h2:mt-6',
              'prose-h3:text-xl prose-h3:font-medium prose-h3:text-gray-700 prose-h3:mb-3 prose-h3:mt-5',
              'prose-h4:text-lg prose-h4:font-medium prose-h4:text-gray-600 prose-h4:mb-2 prose-h4:mt-4',
              // 本文スタイル
              'prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4',
              // リストスタイル（ChatGPT風）
              'prose-ul:space-y-2 prose-li:text-gray-700',
              'prose-ol:space-y-2',
              // 強調とリンク
              'prose-strong:text-gray-900 prose-strong:font-semibold',
              'prose-em:text-gray-600 prose-em:italic',
              'prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline',
              // コードとプリフォーマット
              'prose-code:bg-gray-100 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm prose-code:font-mono',
              'prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-lg prose-pre:p-4',
              // 引用
              'prose-blockquote:border-l-4 prose-blockquote:border-blue-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600',
              // テーブル
              'prose-table:border-collapse prose-th:border prose-th:border-gray-300 prose-th:bg-gray-50 prose-th:font-semibold prose-td:border prose-td:border-gray-300 prose-td:p-2',
              // 編集モード時のスタイル
              isEditing && [
                'focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-opacity-50',
                'min-h-96',
              ]
            )}
            style={{
              // ChatGPT風の追加スタイル
              lineHeight: '1.7',
              fontSize: '16px',
            }}
          />

          {lastAiExplanation && (
            <div className="mt-4 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
              <div className="flex items-start justify-between gap-3">
                <p className="flex-1 leading-relaxed">
                  <span className="font-medium text-gray-800">AIメモ:</span> {lastAiExplanation}
                </p>
                <button
                  type="button"
                  className="rounded px-2 py-1 text-[11px] text-gray-500 transition hover:bg-white"
                  onClick={() => setLastAiExplanation(null)}
                >
                  閉じる
                </button>
              </div>
            </div>
          )}

          {/* 編集モード時のヘルプテキスト */}
          {isEditing && (
            <div className="mt-6 rounded border border-gray-200 bg-gray-50 px-3 py-3 text-xs text-gray-600">
              <p className="mb-2 font-medium text-gray-700">編集のヒント</p>
              <div className="space-y-1">
                <p># 見出し、## 小見出し で構造を調整できます</p>
                <p>**強調** や *斜体* を使って重要な部分を目立たせましょう</p>
                <p>- リスト や 1. 番号付き で要点を整理できます</p>
              </div>
            </div>
          )}

          {/* 未保存の変更通知 */}
          {hasUnsavedChanges && (
            <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-700">
              ⚠️ 未保存の変更があります
            </div>
          )}
        </div>
      </div>

      {/* ✅ ChatGPT風CSSスタイル */}
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

        /* ChatGPT風チェックリストスタイル */
        :global(.checklist-item) {
          margin: 8px 0 !important;
          padding: 8px 12px !important;
          background-color: #f8fafc !important;
          border-radius: 6px !important;
          border-left: 3px solid #10b981 !important;
          font-size: 16px !important;
          line-height: 1.6 !important;
          display: flex !important;
          align-items: center !important;
        }

        /* 見出しの中央寄せ改善 */
        :global(.prose h1) {
          text-align: center !important;
          margin-top: 2rem !important;
          margin-bottom: 1.5rem !important;
          color: #1f2937 !important;
          font-weight: 700 !important;
        }

        /* 絵文字の表示改善 */
        :global(.prose) {
          font-family:
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            'Segoe UI',
            Roboto,
            'Helvetica Neue',
            sans-serif !important;
        }

        /* リストの改善 */
        :global(.prose ul li) {
          margin: 4px 0 !important;
          line-height: 1.6 !important;
        }

        /* 段落の間隔改善 */
        :global(.prose p) {
          margin-top: 1rem !important;
          margin-bottom: 1rem !important;
        }
      `}</style>
    </div>
  );
};

export default CanvasPanel;
