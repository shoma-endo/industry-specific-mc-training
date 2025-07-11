'use client';

import { useEffect, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';

interface RichEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function RichEditor({ 
  value, 
  onChange, 
  placeholder = "メッセージを入力...",
  disabled = false,
  className = ""
}: RichEditorProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // この例では単純なTextareaを使用
  // 実際のプロジェクトでは Monaco Editor や CodeMirror などの重いライブラリを
  // dynamic import で読み込むことを想定
  if (!isClient) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-sm text-gray-500">エディターを読み込み中...</div>
      </div>
    );
  }

  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      rows={4}
    />
  );
}