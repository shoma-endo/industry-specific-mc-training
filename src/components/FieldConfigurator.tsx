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

interface FieldConfigRenderProps {
  visibleSet: Set<string>;
  orderedIds: string[];
}

type StoredConfig =
  | string[]
  | {
      visible?: string[];
      order?: string[];
    };

interface FieldConfiguratorProps {
  columns: ColumnOption[];
  storageKey: string;
  onChange?: (visibleIds: string[], orderedIds: string[]) => void;
  children: (config: FieldConfigRenderProps) => React.ReactNode;
  hideTrigger?: boolean;
  triggerId?: string;
  dialogExtraContent?: React.ReactNode;
}

export default function FieldConfigurator({
  columns,
  storageKey,
  onChange,
  children,
  hideTrigger,
  triggerId,
  dialogExtraContent,
}: FieldConfiguratorProps) {
  const defaultVisibleIds = React.useMemo(
    () => columns.filter(c => c.defaultVisible !== false).map(c => c.id),
    [columns]
  );
  const defaultOrder = React.useMemo(() => columns.map(c => c.id), [columns]);

  const [open, setOpen] = React.useState(false);
  const [visibleIds, setVisibleIds] = React.useState<string[]>(defaultVisibleIds);
  const [orderedIds, setOrderedIds] = React.useState<string[]>(defaultOrder);

  const normalizeOrder = React.useCallback(
    (order: string[]) => {
      const knownIds = columns.map(c => c.id);
      const filtered = order.filter(id => knownIds.includes(id));
      const missing = knownIds.filter(id => !filtered.includes(id));
      return [...filtered, ...missing];
    },
    [columns]
  );

  const persistConfig = React.useCallback(
    (nextVisible: string[], nextOrder: string[]) => {
      localStorage.setItem(storageKey, JSON.stringify({ visible: nextVisible, order: nextOrder }));
    },
    [storageKey]
  );

  const applyConfig = React.useCallback(
    (nextVisible: string[], nextOrder: string[], shouldPersist = false) => {
      const normalizedVisible = nextVisible.filter(id => columns.some(c => c.id === id));
      const normalizedOrder = normalizeOrder(nextOrder);
      setVisibleIds(normalizedVisible);
      setOrderedIds(normalizedOrder);
      onChange?.(normalizedVisible, normalizedOrder);
      if (shouldPersist) {
        persistConfig(normalizedVisible, normalizedOrder);
      }
    },
    [columns, normalizeOrder, onChange, persistConfig]
  );

  React.useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as StoredConfig;

        // 旧フォーマット（string配列）との互換性維持
        if (Array.isArray(parsed)) {
          const normalizedVisible = parsed.filter(id => columns.some(c => c.id === id));
          if (normalizedVisible.length > 0) {
            applyConfig(normalizedVisible, defaultOrder, true);
            return;
          }
        }

        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const visible = Array.isArray(parsed.visible) ? parsed.visible : defaultVisibleIds;
          const order = Array.isArray(parsed.order) ? parsed.order : defaultOrder;
          applyConfig(visible, order, true);
          return;
        }
      }
      applyConfig(defaultVisibleIds, defaultOrder, true);
    } catch {
      applyConfig(defaultVisibleIds, defaultOrder, true);
    }
  }, [applyConfig, columns, defaultOrder, defaultVisibleIds, storageKey]);

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
      persistConfig(next, orderedIds);
      onChange?.(next, orderedIds);
      return next;
    });
  };

  const selectAll = () => {
    persistConfig(defaultVisibleIds, orderedIds);
    setVisibleIds(defaultVisibleIds);
    onChange?.(defaultVisibleIds, orderedIds);
  };

  const clearAll = () => {
    persistConfig([], orderedIds);
    setVisibleIds([]);
    onChange?.([], orderedIds);
  };

  const move = (id: string, direction: 'up' | 'down') => {
    setOrderedIds(prev => {
      const index = prev.indexOf(id);
      if (index === -1) return prev;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const current = prev[index];
      const targetValue = prev[target];
      if (current === undefined || targetValue === undefined) return prev;
      const next = [...prev];
      next[index] = targetValue;
      next[target] = current;
      persistConfig(visibleIds, next);
      onChange?.(visibleIds, next);
      return next;
    });
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
          <DialogContent className="sm:max-w-[900px]">
            <DialogHeader>
              <DialogTitle>フィールド構成</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600 mb-4">
              チェックを付けたフィールドのみテーブルに表示されます。上下矢印のボタンで表示順を変更できます。
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 左側: フィールドリスト */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={selectAll}>
                    全選択
                  </Button>
                  <Button size="sm" variant="secondary" onClick={clearAll}>
                    全解除
                  </Button>
                </div>
                <div className="max-h-[50vh] overflow-auto space-y-2 pr-1">
                  {orderedIds.map((id, index) => {
                    const col = columns.find(c => c.id === id);
                    if (!col) return null;
                    const isFirst = index === 0;
                    const isLast = index === orderedIds.length - 1;
                    return (
                      <div
                        key={col.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-2 hover:bg-gray-50 transition-colors"
                      >
                        <label className="flex items-center gap-2 text-sm flex-1 min-w-0 cursor-pointer">
                          <Checkbox
                            checked={visibleSet.has(col.id)}
                            onCheckedChange={() => toggle(col.id)}
                            aria-label={col.label}
                          />
                          <span className="truncate">{col.label}</span>
                        </label>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => move(col.id, 'up')}
                            disabled={isFirst}
                            aria-label={`${col.label}を上に移動`}
                          >
                            ↑
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => move(col.id, 'down')}
                            disabled={isLast}
                            aria-label={`${col.label}を下に移動`}
                          >
                            ↓
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 右側: カテゴリフィルター */}
              {dialogExtraContent && (
                <div className="border-l-0 lg:border-l border-gray-200 pl-0 lg:pl-6">
                  {dialogExtraContent}
                </div>
              )}
            </div>
            <div className="mt-3 flex justify-end">
              <Button onClick={() => setOpen(false)}>閉じる</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div>{children({ visibleSet, orderedIds })}</div>
    </div>
  );
}
