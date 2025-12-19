'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
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
      <Button variant="outline" className={className} onClick={() => setDialogOpen(true)}>
        <Tag className="w-4 h-4 mr-2" aria-hidden />
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
