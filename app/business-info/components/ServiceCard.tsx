'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardContent } from '@/components/ui/card';
import { Trash2, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { type Service } from '@/server/schemas/brief.schema';

// Auto-resize textarea hook
function useAutoResize() {
  const adjustHeight = useCallback((element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, []);

  return adjustHeight;
}

interface ServiceCardProps {
  service: Service;
  index: number;
  onUpdate: (id: string, updates: Partial<Service>) => void;
  onRemove: (id: string) => void;
  isRemoveDisabled: boolean;
  isReadOnly?: boolean;
}

export function ServiceCard({
  service,
  index,
  onUpdate,
  onRemove,
  isRemoveDisabled,
  isReadOnly = false,
}: ServiceCardProps) {
  const [isOpen, setIsOpen] = useState(index === 0); // 最初のサービスは開いておく
  const adjustHeight = useAutoResize();

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  // Textarea の共通クラス（空の場合は1行、入力があれば自動拡張）
  const textareaClass = 'resize-none overflow-hidden min-h-[38px] leading-normal';

  return (
    <Card
      className={cn(
        'relative border-2 transition-all duration-200 overflow-hidden',
        isOpen ? 'border-primary/20 shadow-sm' : 'border-primary/5 hover:border-primary/15'
      )}
    >
      <div
        className={cn(
          'flex flex-row items-center justify-between p-4 cursor-pointer select-none transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          !isOpen && 'hover:bg-primary/5'
        )}
        onClick={toggleOpen}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleOpen();
          }
        }}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div
            className={cn(
              'p-2 rounded-lg transition-colors',
              isOpen ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
            )}
          >
            <Tag className="h-4 w-4" />
          </div>
          <CardTitle className="text-lg font-bold truncate">
            {service.name || '名称未設定'}
          </CardTitle>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isReadOnly && !isRemoveDisabled && (
            <Button
              variant="ghost"
              size="icon"
              onClick={e => {
                e.stopPropagation(); // アコーディオンの開閉を防止
                onRemove(service.id);
              }}
              className="text-muted-foreground hover:text-destructive transition-colors h-8 w-8"
              title="サービスを削除"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <div className="text-muted-foreground ml-2">
            {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </div>
        </div>
      </div>

      {isOpen && (
        <CardContent className="space-y-4 pt-0 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 gap-4 pt-4 border-t border-primary/10">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                サービス名 <span className="text-destructive font-bold">*</span>
              </label>
              <Textarea
                placeholder="例: エアコンクリーニング"
                value={service.name}
                onChange={e => onUpdate(service.id, { name: e.target.value })}
                onInput={e => adjustHeight(e.currentTarget)}
                ref={el => { if (el) adjustHeight(el); }}
                rows={1}
                className={textareaClass}
                aria-label={`サービス ${index + 1} 名称`}
                required
                disabled={isReadOnly}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">強み</label>
                <Textarea
                  placeholder="徹底した分解洗浄、即日対応可"
                  value={service.strength ?? ''}
                  onChange={e => onUpdate(service.id, { strength: e.target.value })}
                  onInput={e => adjustHeight(e.currentTarget)}
                  ref={el => { if (el) adjustHeight(el); }}
                  rows={1}
                  className={textareaClass}
                  disabled={isReadOnly}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => e.stopPropagation()}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">いくらで（最低価格）</label>
                <Textarea
                  placeholder="8,800円〜"
                  value={service.price ?? ''}
                  onChange={e => onUpdate(service.id, { price: e.target.value })}
                  onInput={e => adjustHeight(e.currentTarget)}
                  ref={el => { if (el) adjustHeight(el); }}
                  rows={1}
                  className={textareaClass}
                  disabled={isReadOnly}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => e.stopPropagation()}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">いつ（対応日時）</label>
                <Textarea
                  placeholder="年中無休、土日祝対応"
                  value={service.when ?? ''}
                  onChange={e => onUpdate(service.id, { when: e.target.value })}
                  onInput={e => adjustHeight(e.currentTarget)}
                  ref={el => { if (el) adjustHeight(el); }}
                  rows={1}
                  className={textareaClass}
                  disabled={isReadOnly}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => e.stopPropagation()}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">どこで（地域）</label>
                <Textarea
                  placeholder="東京都内全域、神奈川県一部"
                  value={service.where ?? ''}
                  onChange={e => onUpdate(service.id, { where: e.target.value })}
                  onInput={e => adjustHeight(e.currentTarget)}
                  ref={el => { if (el) adjustHeight(el); }}
                  rows={1}
                  className={textareaClass}
                  disabled={isReadOnly}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => e.stopPropagation()}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">誰が（有資格者）</label>
                <Textarea
                  placeholder="エアコンクリーニング士在籍"
                  value={service.who ?? ''}
                  onChange={e => onUpdate(service.id, { who: e.target.value })}
                  onInput={e => adjustHeight(e.currentTarget)}
                  ref={el => { if (el) adjustHeight(el); }}
                  rows={1}
                  className={textareaClass}
                  disabled={isReadOnly}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => e.stopPropagation()}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">なぜ（キャンペーン）</label>
                <Textarea
                  placeholder="今なら複数台割引実施中"
                  value={service.why ?? ''}
                  onChange={e => onUpdate(service.id, { why: e.target.value })}
                  onInput={e => adjustHeight(e.currentTarget)}
                  ref={el => { if (el) adjustHeight(el); }}
                  rows={1}
                  className={textareaClass}
                  disabled={isReadOnly}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => e.stopPropagation()}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">何を（サービス詳細）</label>
                <Textarea
                  placeholder="家庭用・業務用エアコンの内部洗浄"
                  value={service.what ?? ''}
                  onChange={e => onUpdate(service.id, { what: e.target.value })}
                  onInput={e => adjustHeight(e.currentTarget)}
                  ref={el => { if (el) adjustHeight(el); }}
                  rows={1}
                  className={textareaClass}
                  disabled={isReadOnly}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => e.stopPropagation()}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">どのように（問い合わせ方法）</label>
                <Textarea
                  placeholder="Webフォーム、お電話、LINE"
                  value={service.how ?? ''}
                  onChange={e => onUpdate(service.id, { how: e.target.value })}
                  onInput={e => adjustHeight(e.currentTarget)}
                  ref={el => { if (el) adjustHeight(el); }}
                  rows={1}
                  className={textareaClass}
                  disabled={isReadOnly}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => e.stopPropagation()}
                />
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
