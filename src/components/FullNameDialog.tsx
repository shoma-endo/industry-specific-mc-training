"use client"

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface FullNameDialogProps {
  open: boolean;
  onSave: (fullName: string) => Promise<void>;
}

export const FullNameDialog = ({ open, onSave }: FullNameDialogProps) => {
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!fullName.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      await onSave(fullName.trim());
      setFullName('');
    } catch (error) {
      console.error('フルネーム保存エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>フルネームを入力してください</DialogTitle>
          <DialogDescription>
            サービスを利用するためにフルネームの入力が必要です。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="山田 太郎"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            required
            autoFocus
          />
          <Button
            onClick={handleSave}
            disabled={!fullName.trim() || isLoading}
            className="w-full"
          >
            {isLoading ? '保存中...' : '保存'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};