'use client';

import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  text: string;
  lines?: number; // default 2
  className?: string;
}

export default function TruncatedText({ text, lines = 2, className }: Props) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 判定: 実高さよりスクロール高が大きければトリミングされている
    const check = () => {
      const rectH = el.getBoundingClientRect().height;
      const scrollH = el.scrollHeight;
      setIsTruncated(scrollH - rectH > 1);
    };
    check();
    // リサイズ時にも再判定
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [text, lines]);

  const content = (
    <div
      ref={ref}
      className={`whitespace-pre-wrap break-words overflow-hidden ${className || ''}`}
      style={{
        display: '-webkit-box',
        WebkitLineClamp: lines,
        WebkitBoxOrient: 'vertical' as const,
        cursor: isTruncated ? 'help' : 'default',
      }}
    >
      {text}
    </div>
  );

  if (!isTruncated) return content;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent className="max-w-[520px] whitespace-pre-wrap break-words">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
