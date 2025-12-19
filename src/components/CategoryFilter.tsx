'use client';

import * as React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { ContentCategory } from '@/types/category';
import { getContentCategories } from '@/server/actions/category.actions';
import { ANALYTICS_STORAGE_KEYS, type StoredCategoryFilter } from '@/lib/constants';

interface CategoryFilterProps {
  selectedCategoryIds: string[];
  includeUncategorized: boolean;
  onFilterChange: (selectedCategoryIds: string[], includeUncategorized: boolean) => void;
  refreshTrigger?: number;
}

export default function CategoryFilter({
  selectedCategoryIds,
  includeUncategorized,
  onFilterChange,
  refreshTrigger,
}: CategoryFilterProps) {
  const [categories, setCategories] = React.useState<ContentCategory[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

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

  // フィルター変更時に永続化
  const syncToStorage = React.useCallback((ids: string[], includeUncat: boolean) => {
    if (typeof window !== 'undefined') {
      const stored: StoredCategoryFilter = {
        selectedCategoryIds: ids,
        includeUncategorized: includeUncat,
      };
      localStorage.setItem(ANALYTICS_STORAGE_KEYS.CATEGORY_FILTER, JSON.stringify(stored));
    }
  }, []);

  const toggleCategory = (categoryId: string) => {
    const nextIds = selectedCategoryIds.includes(categoryId)
      ? selectedCategoryIds.filter(id => id !== categoryId)
      : [...selectedCategoryIds, categoryId];
    
    onFilterChange(nextIds, includeUncategorized);
    syncToStorage(nextIds, includeUncategorized);
  };

  const selectAll = () => {
    const allIds = categories.map(c => c.id);
    onFilterChange(allIds, true);
    syncToStorage(allIds, true);
  };

  const clearAll = () => {
    onFilterChange([], false);
    syncToStorage([], false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    );
  }

  const hasAnySelection = selectedCategoryIds.length > 0 || includeUncategorized;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-gray-700">カテゴリでフィルター</span>
          <p className="text-xs text-gray-500">複数選択時は、いずれかに該当するコンテンツを表示</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={selectAll} className="h-7 px-3 text-xs">
            全選択
          </Button>
          <Button size="sm" variant="outline" onClick={clearAll} className="h-7 px-3 text-xs">
            全解除
          </Button>
        </div>
      </div>

      {!hasAnySelection && (
        <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
          フィルターが未選択のため、全件表示されます
        </p>
      )}

      <div className="max-h-[200px] overflow-y-auto space-y-2">
        {categories.map(category => (
          <label
            key={category.id}
            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
          >
            <Checkbox
              checked={selectedCategoryIds.includes(category.id)}
              onCheckedChange={() => toggleCategory(category.id)}
            />
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: category.color }}
            />
            <span className="text-sm truncate">{category.name}</span>
          </label>
        ))}

        {/* 未分類 */}
        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded border-t pt-2 mt-2">
          <Checkbox
            checked={includeUncategorized}
            onCheckedChange={checked => {
              const nextVal = !!checked;
              onFilterChange(selectedCategoryIds, nextVal);
              syncToStorage(selectedCategoryIds, nextVal);
            }}
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
