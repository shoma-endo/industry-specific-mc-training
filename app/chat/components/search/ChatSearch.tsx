'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatSearchProps {
  query: string;
  isSearching: boolean;
  error: string | null;
  onSearch: (query: string) => void;
  onClear: () => void;
  className?: string;
  inputClassName?: string;
}

const ChatSearch: React.FC<ChatSearchProps> = ({
  query,
  isSearching,
  error,
  onSearch,
  onClear,
  className,
  inputClassName,
}) => {
  const [value, setValue] = useState(query);
  const [isComposing, setIsComposing] = useState(false);
  const lastIssuedRef = useRef<string>('');
  const pendingQueryRef = useRef<string>('');

  useEffect(() => {
    setValue(query);
    if (query === '') {
      lastIssuedRef.current = '';
    }
  }, [query]);

  useEffect(() => {
    if (isComposing) {
      pendingQueryRef.current = value;
      return;
    }

    const trimmed = value.trim();
    const timer = setTimeout(() => {
      if (isComposing) {
        return;
      }

      if (trimmed === '') {
        if (lastIssuedRef.current !== '' || query !== '') {
          lastIssuedRef.current = '';
          onClear();
        }
        return;
      }

      if (trimmed === lastIssuedRef.current && trimmed === query) {
        return;
      }

      lastIssuedRef.current = trimmed;
      onSearch(trimmed);
    }, 300);

    return () => clearTimeout(timer);
  }, [value, isComposing, onSearch, onClear, query]);

  useEffect(() => {
    if (!isComposing && pendingQueryRef.current !== '') {
      const latest = pendingQueryRef.current;
      pendingQueryRef.current = '';
      setValue(latest);
    }
  }, [isComposing]);

  const handleClear = () => {
    setValue('');
    lastIssuedRef.current = '';
    onClear();
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = (event: React.CompositionEvent<HTMLInputElement>) => {
    setIsComposing(false);
    const finalValue = event.currentTarget.value;
    setValue(finalValue);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={value}
          onChange={event => setValue(event.target.value)}
          placeholder="タイトルやURLで検索"
          className={cn('pl-9 pr-16', inputClassName)}
          aria-label="チャット履歴を検索"
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onCompositionUpdate={event => {
            pendingQueryRef.current = event.currentTarget.value;
          }}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="検索条件をクリア"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {isSearching && (
          <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
};

export default ChatSearch;
