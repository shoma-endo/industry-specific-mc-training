'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Settings } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface ColumnOption {
  id: string;
  label: string;
  defaultVisible?: boolean;
}

interface FieldConfiguratorProps {
  columns: ColumnOption[];
  storageKey: string;
  onChange?: (visibleIds: string[]) => void;
  children: (visibleSet: Set<string>) => React.ReactNode;
  hideTrigger?: boolean;
  triggerId?: string;
}

export default function FieldConfigurator({
  columns,
  storageKey,
  onChange,
  children,
  hideTrigger,
  triggerId,
}: FieldConfiguratorProps) {
  const defaultVisibleIds = React.useMemo(
    () => columns.filter(c => c.defaultVisible !== false).map(c => c.id),
    [columns]
  );

  const [open, setOpen] = React.useState(false);
  const [visibleIds, setVisibleIds] = React.useState<string[]>(defaultVisibleIds);

  React.useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      if (raw) {
        const saved = JSON.parse(raw) as string[];
        // フィールド定義変更時の整合性確保（未知IDは除外）
        const normalized = saved.filter(id => columns.some(c => c.id === id));
        if (normalized.length > 0) {
          setVisibleIds(normalized);
          onChange?.(normalized);
          return;
        }
      }
      setVisibleIds(defaultVisibleIds);
      onChange?.(defaultVisibleIds);
    } catch {
      setVisibleIds(defaultVisibleIds);
      onChange?.(defaultVisibleIds);
    }
  }, [columns, defaultVisibleIds, onChange, storageKey]);

  const visibleSet = React.useMemo(() => new Set(visibleIds), [visibleIds]);

  // 外部ボタン（triggerId）から開くためのリスナー
  React.useEffect(() => {
    if (!triggerId) return;
    if (typeof window === 'undefined') return;
    const el = document.getElementById(triggerId);
    if (!el) return;
    const onClick = (e: Event) => {
      e.preventDefault();
      setOpen(true);
    };
    el.addEventListener('click', onClick);
    return () => {
      el.removeEventListener('click', onClick);
    };
  }, [triggerId]);

  const toggle = (id: string) => {
    setVisibleIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem(storageKey, JSON.stringify(next));
      onChange?.(next);
      return next;
    });
  };

  const selectAll = () => {
    localStorage.setItem(storageKey, JSON.stringify(defaultVisibleIds));
    setVisibleIds(defaultVisibleIds);
    onChange?.(defaultVisibleIds);
  };

  const clearAll = () => {
    localStorage.setItem(storageKey, JSON.stringify([]));
    setVisibleIds([]);
    onChange?.([]);
  };

  return (
    <div className="w-full">
      <div className={hideTrigger ? 'sr-only' : 'flex items-center justify-start mb-2'}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              id={triggerId || 'field-configurator-trigger'}
              variant="outline"
              className="bg-black text-white hover:bg-black/90 border-transparent"
            >
              <Settings className="mr-2 h-4 w-4" />
              フィールド構成
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>フィールド構成</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600 mb-3">
              チェックを付けたフィールドのみテーブルに表示されます。<br />
              設定はブラウザに保存され、次回以降も反映されます。
            </p>
            <div className="flex items-center gap-2 mb-3">
              <Button size="sm" variant="secondary" onClick={selectAll}>
                全選択
              </Button>
              <Button size="sm" variant="secondary" onClick={clearAll}>
                全解除
              </Button>
            </div>
            <div className="max-h-[50vh] overflow-auto space-y-2 pr-1">
              {columns.map(col => (
                <label key={col.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={visibleSet.has(col.id)}
                    onCheckedChange={() => toggle(col.id)}
                    aria-label={col.label}
                  />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <Button onClick={() => setOpen(false)}>閉じる</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div>{children(visibleSet)}</div>
    </div>
  );
}
