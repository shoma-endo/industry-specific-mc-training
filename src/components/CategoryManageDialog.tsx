'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Loader2, Plus, Pencil, Trash2, GripVertical, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ContentCategory } from '@/types/category';
import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR } from '@/types/category';
import {
  getContentCategories,
  createContentCategory,
  updateContentCategory,
  deleteContentCategory,
  updateCategorySortOrder,
} from '@/server/actions/category.actions';

interface CategoryManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoriesChange?: () => void;
}

interface EditingCategory {
  id: string | null;
  name: string;
  color: string;
}

export default function CategoryManageDialog({
  open,
  onOpenChange,
  onCategoriesChange,
}: CategoryManageDialogProps) {
  const [categories, setCategories] = React.useState<ContentCategory[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [editing, setEditing] = React.useState<EditingCategory | null>(null);
  const [isAdding, setIsAdding] = React.useState(false);
  const [newCategory, setNewCategory] = React.useState<EditingCategory>({
    id: null,
    name: '',
    color: DEFAULT_CATEGORY_COLOR,
  });
  const [draggedId, setDraggedId] = React.useState<string | null>(null);

  const loadCategories = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getContentCategories();
      if (result.success) {
        setCategories(result.data);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('カテゴリの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      loadCategories();
    }
  }, [open, loadCategories]);

  const handleCreate = async () => {
    if (!newCategory.name.trim()) {
      toast.error('カテゴリ名を入力してください');
      return;
    }

    setIsSaving(true);
    try {
      const result = await createContentCategory({
        name: newCategory.name,
        color: newCategory.color,
      });

      if (result.success) {
        setCategories(prev => [...prev, result.data]);
        setNewCategory({ id: null, name: '', color: DEFAULT_CATEGORY_COLOR });
        setIsAdding(false);
        toast.success('カテゴリを作成しました');
        onCategoriesChange?.();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('カテゴリの作成に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editing?.id || !editing.name.trim()) {
      toast.error('カテゴリ名を入力してください');
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateContentCategory(editing.id, {
        name: editing.name,
        color: editing.color,
      });

      if (result.success) {
        setCategories(prev => prev.map(c => (c.id === editing.id ? result.data : c)));
        setEditing(null);
        toast.success('カテゴリを更新しました');
        onCategoriesChange?.();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('カテゴリの更新に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (categoryId: string) => {
    if (!confirm('このカテゴリを削除しますか？\n紐付けられたコンテンツからも解除されます。')) {
      return;
    }

    setIsSaving(true);
    try {
      const result = await deleteContentCategory(categoryId);

      if (result.success) {
        setCategories(prev => prev.filter(c => c.id !== categoryId));
        toast.success('カテゴリを削除しました');
        onCategoriesChange?.();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('カテゴリの削除に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, categoryId: string) => {
    setDraggedId(categoryId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const draggedIndex = categories.findIndex(c => c.id === draggedId);
    const targetIndex = categories.findIndex(c => c.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null);
      return;
    }

    const newCategories = [...categories];
    const removedItems = newCategories.splice(draggedIndex, 1);
    const draggedItem = removedItems[0];
    if (!draggedItem) {
      setDraggedId(null);
      return;
    }
    newCategories.splice(targetIndex, 0, draggedItem);

    setCategories(newCategories);
    setDraggedId(null);

    // 並び順をサーバーに保存
    const categoryIds = newCategories.map(c => c.id);
    const result = await updateCategorySortOrder(categoryIds);
    if (!result.success) {
      toast.error(result.error);
      loadCategories();
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>カテゴリ管理</DialogTitle>
          <DialogDescription>
            コンテンツを分類するためのカテゴリを管理します。
            ドラッグ＆ドロップで並び順を変更できます。
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* カテゴリ一覧 */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {categories.length === 0 && !isAdding && (
                <p className="text-sm text-gray-500 text-center py-4">
                  カテゴリがありません。追加してください。
                </p>
              )}

              {categories.map(category => (
                <div
                  key={category.id}
                  draggable={!editing}
                  onDragStart={e => handleDragStart(e, category.id)}
                  onDragOver={handleDragOver}
                  onDrop={e => handleDrop(e, category.id)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 p-3 rounded-lg border ${
                    draggedId === category.id
                      ? 'opacity-50 border-dashed border-primary'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${editing?.id === category.id ? 'bg-gray-50' : 'bg-white'}`}
                >
                  {editing?.id === category.id ? (
                    <>
                      <div className="flex-1 flex items-center gap-2">
                        <ColorPicker
                          value={editing.color}
                          onChange={color => setEditing(prev => (prev ? { ...prev, color } : prev))}
                        />
                        <Input
                          value={editing.name}
                          onChange={e =>
                            setEditing(prev => (prev ? { ...prev, name: e.target.value } : prev))
                          }
                          className="flex-1 h-8"
                          autoFocus
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleUpdate}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4 text-green-600" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditing(null)}
                        disabled={isSaving}
                      >
                        <X className="h-4 w-4 text-gray-500" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" />
                      <span
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="flex-1 text-sm">{category.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          setEditing({
                            id: category.id,
                            name: category.name,
                            color: category.color,
                          })
                        }
                        disabled={isSaving}
                      >
                        <Pencil className="h-4 w-4 text-gray-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDelete(category.id)}
                        disabled={isSaving}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </>
                  )}
                </div>
              ))}

              {/* 新規追加フォーム */}
              {isAdding && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-primary bg-primary/5">
                  <div className="flex-1 flex items-center gap-2">
                    <ColorPicker
                      value={newCategory.color}
                      onChange={color => setNewCategory(prev => ({ ...prev, color }))}
                    />
                    <Input
                      value={newCategory.name}
                      onChange={e => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="カテゴリ名"
                      className="flex-1 h-8"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleCreate();
                        if (e.key === 'Escape') setIsAdding(false);
                      }}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleCreate}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setIsAdding(false);
                      setNewCategory({ id: null, name: '', color: DEFAULT_CATEGORY_COLOR });
                    }}
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </Button>
                </div>
              )}
            </div>

            {/* 追加ボタン */}
            {!isAdding && !editing && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsAdding(true)}
                disabled={isSaving}
              >
                <Plus className="h-4 w-4 mr-2" />
                カテゴリを追加
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-6 h-6 rounded-full border-2 border-white shadow-sm cursor-pointer hover:scale-110 transition-transform"
          style={{ backgroundColor: value }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" side="bottom" align="start">
        <div className="grid grid-cols-5 gap-1">
          {CATEGORY_COLORS.map(color => (
            <button
              key={color}
              type="button"
              className={`w-6 h-6 rounded-full cursor-pointer hover:scale-110 transition-transform ${
                value === color ? 'ring-2 ring-offset-1 ring-primary' : ''
              }`}
              style={{ backgroundColor: color }}
              onClick={() => {
                onChange(color);
              }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
