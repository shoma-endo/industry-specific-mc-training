'use client';

import * as React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import type { ContentCategory } from '@/types/category';
import { getContentCategories } from '@/server/actions/category.actions';

interface CategorySelectorProps {
  selectedCategoryIds: string[];
  onSelectedChange: React.Dispatch<React.SetStateAction<string[]>>;
  refreshTrigger?: number;
}

export default function CategorySelector({
  selectedCategoryIds,
  onSelectedChange,
  refreshTrigger,
}: CategorySelectorProps) {
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

  React.useEffect(() => {
    loadCategories();
  }, [loadCategories, refreshTrigger]);

  const toggleCategory = (categoryId: string) => {
    onSelectedChange(prev =>
      prev.includes(categoryId) ? prev.filter(id => id !== categoryId) : [...prev, categoryId]
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        カテゴリがありません。「カテゴリ管理」から追加してください。
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map(category => {
        const isSelected = selectedCategoryIds.includes(category.id);
        return (
          <label
            key={category.id}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
              isSelected
                ? 'border-transparent text-white'
                : 'border-gray-300 bg-white hover:bg-gray-50'
            }`}
            style={isSelected ? { backgroundColor: category.color } : undefined}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleCategory(category.id)}
              className={isSelected ? 'border-white data-[state=checked]:bg-white/20' : ''}
            />
            <span className="text-sm">{category.name}</span>
          </label>
        );
      })}
    </div>
  );
}
