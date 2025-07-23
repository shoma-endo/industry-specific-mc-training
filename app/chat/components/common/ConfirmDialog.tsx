'use client';

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2, Save, Download, LogOut } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive' | 'warning';
  icon?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

const variantConfig = {
  default: {
    confirmButtonVariant: 'default' as const,
    iconColor: 'text-blue-500',
    defaultIcon: <Save className="w-6 h-6" />,
  },
  destructive: {
    confirmButtonVariant: 'destructive' as const,
    iconColor: 'text-red-500',
    defaultIcon: <Trash2 className="w-6 h-6" />,
  },
  warning: {
    confirmButtonVariant: 'default' as const,
    iconColor: 'text-yellow-500',
    defaultIcon: <AlertTriangle className="w-6 h-6" />,
  },
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText = '確認',
  cancelText = 'キャンセル',
  variant = 'default',
  icon,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const config = variantConfig[variant];
  const displayIcon = icon || config.defaultIcon;

  const handleConfirm = async () => {
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      console.error('Confirm action failed:', error);
      // エラーが発生してもダイアログは閉じない
    }
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            {displayIcon && (
              <div className={`flex-shrink-0 ${config.iconColor}`}>
                {displayIcon}
              </div>
            )}
            <div>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription className="mt-2">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={handleCancel}
            disabled={isLoading}
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant={config.confirmButtonVariant}
              onClick={handleConfirm}
              disabled={isLoading}
            >
              {isLoading ? '処理中...' : confirmText}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// プリセット付きのヘルパーコンポーネント
interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  open,
  onOpenChange,
  itemName,
  onConfirm,
  isLoading = false,
}) => (
  <ConfirmDialog
    open={open}
    onOpenChange={onOpenChange}
    title="削除の確認"
    description={`${itemName}を削除してもよろしいですか？この操作は取り消せません。`}
    confirmText="削除"
    cancelText="キャンセル"
    variant="destructive"
    onConfirm={onConfirm}
    isLoading={isLoading}
  />
);

interface SaveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

export const SaveConfirmDialog: React.FC<SaveConfirmDialogProps> = ({
  open,
  onOpenChange,
  itemName,
  onConfirm,
  isLoading = false,
}) => (
  <ConfirmDialog
    open={open}
    onOpenChange={onOpenChange}
    title="保存の確認"
    description={`${itemName}を保存しますか？`}
    confirmText="保存"
    cancelText="キャンセル"
    variant="default"
    icon={<Save className="w-6 h-6" />}
    onConfirm={onConfirm}
    isLoading={isLoading}
  />
);

interface ExportConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  format: string;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

export const ExportConfirmDialog: React.FC<ExportConfirmDialogProps> = ({
  open,
  onOpenChange,
  format,
  onConfirm,
  isLoading = false,
}) => (
  <ConfirmDialog
    open={open}
    onOpenChange={onOpenChange}
    title="エクスポートの確認"
    description={`${format.toUpperCase()}形式でエクスポートしますか？`}
    confirmText="エクスポート"
    cancelText="キャンセル"
    variant="default"
    icon={<Download className="w-6 h-6" />}
    onConfirm={onConfirm}
    isLoading={isLoading}
  />
);

interface LogoutConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

export const LogoutConfirmDialog: React.FC<LogoutConfirmDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}) => (
  <ConfirmDialog
    open={open}
    onOpenChange={onOpenChange}
    title="ログアウトの確認"
    description="ログアウトしてもよろしいですか？未保存の作業は失われる可能性があります。"
    confirmText="ログアウト"
    cancelText="キャンセル"
    variant="warning"
    icon={<LogOut className="w-6 h-6" />}
    onConfirm={onConfirm}
    isLoading={isLoading}
  />
);

export default ConfirmDialog;