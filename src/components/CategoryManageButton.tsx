'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tag } from 'lucide-react';
import CategoryManageDialog from '@/components/CategoryManageDialog';

interface CategoryManageButtonProps {
  onCategoriesChange?: () => void;
  className?: string;
}

export default function CategoryManageButton({
  onCategoriesChange,
  className,
}: CategoryManageButtonProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  return (
    <>
      <Button
        variant="outline"
        className={cn('flex items-center gap-2', className)}
        onClick={() => setDialogOpen(true)}
      >
        <Tag className="h-4 w-4" aria-hidden />
        カテゴリ管理
      </Button>
      <CategoryManageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        {...(onCategoriesChange ? { onCategoriesChange } : {})}
      />
    </>
  );
}
