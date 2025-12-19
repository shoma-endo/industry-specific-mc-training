'use client';

import * as React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { ContentCategory } from '@/types/category';
import { getContentCategories } from '@/server/actions/category.actions';

const STORAGE_KEY = 'analytics.categoryFilter';

interface StoredFilter {
  selectedCategoryIds: string[];
  includeUncategorized: boolean;
}

interface CategoryFilterProps {
  onFilterChange: (selectedCategoryIds: string[], includeUncategorized: boolean) => void;
  refreshTrigger?: number;
}

export default function CategoryFilter({ onFilterChange, refreshTrigger }: CategoryFilterProps) {
  const [categories, setCategories] = React.useState<ContentCategory[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [includeUncategorized, setIncludeUncategorized] = React.useState(true);

  const loadCategories = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getContentCategories();
      if (result.success) {
        setCategories(result.data);
      }
    } catch {
      console.error('Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初回ロード & refreshTrigger変更時
  React.useEffect(() => {
    loadCategories();
  }, [loadCategories, refreshTrigger]);

  // localStorageから復元
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StoredFilter;
        if (Array.isArray(parsed.selectedCategoryIds)) {
          setSelectedIds(new Set(parsed.selectedCategoryIds));
        }
        if (typeof parsed.includeUncategorized === 'boolean') {
          setIncludeUncategorized(parsed.includeUncategorized);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // フィルター変更時にコールバック & 永続化
  React.useEffect(() => {
    const ids = Array.from(selectedIds);
    onFilterChange(ids, includeUncategorized);

    if (typeof window !== 'undefined') {
      const stored: StoredFilter = {
        selectedCategoryIds: ids,
        includeUncategorized,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    }
  }, [selectedIds, includeUncategorized, onFilterChange]);

  const toggleCategory = (categoryId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(categories.map(c => c.id)));
    setIncludeUncategorized(true);
  };

  const clearAll = () => {
    setSelectedIds(new Set());
    setIncludeUncategorized(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    );
  }

  const hasAnySelection = selectedIds.size > 0 || includeUncategorized;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">カテゴリでフィルター</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={selectAll} className="h-7 px-2 text-xs">
            全選択
          </Button>
          <Button size="sm" variant="ghost" onClick={clearAll} className="h-7 px-2 text-xs">
            全解除
          </Button>
        </div>
      </div>

      {!hasAnySelection && (
        <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
          フィルターが未選択のため、全件表示されます
        </p>
      )}

      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {categories.map(category => (
          <label
            key={category.id}
            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
          >
            <Checkbox
              checked={selectedIds.has(category.id)}
              onCheckedChange={() => toggleCategory(category.id)}
            />
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: category.color }}
            />
            <span className="text-sm">{category.name}</span>
          </label>
        ))}

        {/* 未分類 */}
        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded border-t pt-2 mt-2">
          <Checkbox
            checked={includeUncategorized}
            onCheckedChange={checked => setIncludeUncategorized(!!checked)}
          />
          <span className="w-3 h-3 rounded-full flex-shrink-0 bg-gray-300" />
          <span className="text-sm text-gray-600">未分類</span>
        </label>
      </div>

      {categories.length === 0 && (
        <p className="text-xs text-gray-500 text-center py-2">
          カテゴリがありません。「カテゴリ管理」から追加してください。
        </p>
      )}
    </div>
  );
}
