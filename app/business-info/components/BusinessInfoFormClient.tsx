'use client';

import { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFeedbackDialog } from '@/hooks/useFeedbackDialog';
import { useLiffContext } from '@/components/LiffProvider';
import { saveBrief, getBrief } from '@/server/actions/brief.actions';
import { paymentEnum, type Payment, type BriefInput } from '@/server/schemas/brief.schema';
import { Building2, Loader2, Save } from 'lucide-react';

interface BusinessInfoFormClientProps {
  initialData: BriefInput | null;
}

// Next.js 15ベストプラクティス: BriefInputを直接拡張して型安全性を保つ
interface FormState extends BriefInput {
  payments: Payment[]; // paymentsは必須配列として明示的に定義
}

// Next.js 15ベストプラクティス: Nullish Coalescingとデフォルト値の使用
const createInitialState = (data?: Partial<BriefInput>): FormState => ({
  service: data?.service,
  company: data?.company,
  address: data?.address,
  ceo: data?.ceo,
  hobby: data?.hobby,
  staff: data?.staff,
  staffHobby: data?.staffHobby,
  businessHours: data?.businessHours,
  holiday: data?.holiday,
  tel: data?.tel,
  license: data?.license,
  qualification: data?.qualification,
  capital: data?.capital,
  email: data?.email,
  payments: data?.payments || [],
  benchmarkUrl: data?.benchmarkUrl,
  competitorCopy: data?.competitorCopy,
  persona: data?.persona,
  strength: data?.strength,
  when: data?.when,
  where: data?.where,
  who: data?.who,
  why: data?.why,
  what: data?.what,
  how: data?.how,
  price: data?.price,
});

export default function BusinessInfoFormClient({ initialData }: BusinessInfoFormClientProps) {
  const { getAccessToken, isLoggedIn } = useLiffContext();
  const [form, setForm] = useState<FormState>(() => createInitialState());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const { feedback, showFeedback, closeFeedback } = useFeedbackDialog();

  // 初期データの読み込み
  useEffect(() => {
    const loadData = async () => {
      try {
        if (!isLoggedIn) {
          setError('ログインが必要です');
          return;
        }

        // Server Componentから渡された初期データがある場合は使用
        if (initialData) {
          setForm(createInitialState(initialData));
          return;
        }

        // 初期データがない場合はClient側で取得
        const token = await getAccessToken();
        if (!token) {
          setError('認証トークンの取得に失敗しました');
          return;
        }

        const { data, success, error: fetchError } = await getBrief(token);
        if (!success) {
          setError(fetchError || '事業者情報の取得に失敗しました');
          return;
        }

        if (data) {
          setForm(createInitialState(data));
        }
      } catch (err) {
        console.error('データ読み込みエラー:', err);
        setError('データの読み込みに失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [getAccessToken, isLoggedIn, initialData]);

  // Next.js 15ベストプラクティス: 型安全なupdater関数
  const handleUpdate = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleTogglePayment = useCallback((payment: Payment) => {
    setForm(prev => ({
      ...prev,
      payments: prev.payments.includes(payment)
        ? prev.payments.filter(p => p !== payment)
        : [...prev.payments, payment],
    }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!isLoggedIn) {
        setError('ログインが必要です');
        return;
      }

      setIsSaving(true);
      setError('');

      try {
        const token = await getAccessToken();
        if (!token) {
          setError('認証トークンの取得に失敗しました');
          return;
        }

        const { success, error: saveError } = await saveBrief({
          ...form,
          liffAccessToken: token,
        });

        if (!success) {
          setError(saveError || '事業者情報の保存に失敗しました');
          showFeedback({
            title: '保存に失敗しました',
            message: saveError || '事業者情報の保存に失敗しました',
            variant: 'error',
          });
          return;
        }

        showFeedback({
          title: '事業者情報を保存しました',
          message: '入力内容が保存されました。',
          variant: 'success',
        });
      } catch (err) {
        console.error('保存エラー:', err);
        setError('保存処理でエラーが発生しました');
        showFeedback({
          title: '保存に失敗しました',
          message: '保存処理でエラーが発生しました',
          variant: 'error',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [form, getAccessToken, isLoggedIn, showFeedback]
  );

  // 早期リターン - LIFF未ログイン状態
  if (!isLoggedIn) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p>ログインが必要です</p>
      </div>
    );
  }

  // 早期リターン - データ初期化中
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div
          className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"
          role="alert"
          aria-live="polite"
        >
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="text-center">
        <p className="text-gray-600 mb-6">
          広告文・LP・ブログ記事作成の土台となる事業者情報を入力してください。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* プロフィール情報セクション */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              プロフィール情報
            </CardTitle>
            <CardDescription>基本的な事業者情報を入力してください</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="サービス内容"
              value={form.service ?? ''}
              onChange={e => handleUpdate('service', e.target.value || undefined)}
              aria-label="サービス内容"
            />
            <Input
              placeholder="会社名"
              value={form.company ?? ''}
              onChange={e => handleUpdate('company', e.target.value || undefined)}
              aria-label="会社名"
            />
            <Input
              placeholder="所在地"
              value={form.address ?? ''}
              onChange={e => handleUpdate('address', e.target.value || undefined)}
              aria-label="所在地"
            />
            <Input
              placeholder="代表者名"
              value={form.ceo ?? ''}
              onChange={e => handleUpdate('ceo', e.target.value || undefined)}
              aria-label="代表者名"
            />
            <Input
              placeholder="趣味・休日の過ごし方"
              value={form.hobby ?? ''}
              onChange={e => handleUpdate('hobby', e.target.value || undefined)}
              aria-label="趣味・休日の過ごし方"
            />
            <Input
              placeholder="スタッフ名"
              value={form.staff ?? ''}
              onChange={e => handleUpdate('staff', e.target.value || undefined)}
              aria-label="スタッフ名"
            />
            <Input
              placeholder="スタッフの趣味・休日の過ごし方"
              value={form.staffHobby ?? ''}
              onChange={e => handleUpdate('staffHobby', e.target.value || undefined)}
              aria-label="スタッフの趣味・休日の過ごし方"
            />
            <Input
              placeholder="営業時間"
              value={form.businessHours ?? ''}
              onChange={e => handleUpdate('businessHours', e.target.value || undefined)}
              aria-label="営業時間"
            />
            <Input
              placeholder="休日"
              value={form.holiday ?? ''}
              onChange={e => handleUpdate('holiday', e.target.value || undefined)}
              aria-label="休日"
            />
            <Input
              placeholder="電話番号"
              value={form.tel ?? ''}
              onChange={e => handleUpdate('tel', e.target.value || undefined)}
              aria-label="電話番号"
            />
            <Input
              placeholder="許可番号"
              value={form.license ?? ''}
              onChange={e => handleUpdate('license', e.target.value || undefined)}
              aria-label="許可番号"
            />
            <Input
              placeholder="保有資格"
              value={form.qualification ?? ''}
              onChange={e => handleUpdate('qualification', e.target.value || undefined)}
              aria-label="保有資格"
            />
            <Input
              placeholder="資本金"
              value={form.capital ?? ''}
              onChange={e => handleUpdate('capital', e.target.value || undefined)}
              aria-label="資本金"
            />
            <Input
              placeholder="メールアドレス"
              type="email"
              value={form.email ?? ''}
              onChange={e => handleUpdate('email', e.target.value || undefined)}
              aria-label="メールアドレス"
            />

            <div>
              <p className="mb-2 font-medium">決済方法</p>
              <div role="group" aria-labelledby="payment-methods">
                {paymentEnum.options.map(payment => (
                  <div key={payment} className="flex items-center space-x-2 mb-1">
                    <Checkbox
                      checked={form.payments.includes(payment as Payment)}
                      onCheckedChange={() => handleTogglePayment(payment as Payment)}
                      aria-label={`決済方法: ${payment}`}
                    />
                    <span className="text-sm">{payment}</span>
                  </div>
                ))}
              </div>
            </div>

            <Input
              placeholder="ベンチマーク先 URL"
              value={form.benchmarkUrl ?? ''}
              onChange={e => handleUpdate('benchmarkUrl', e.target.value || undefined)}
              aria-label="ベンチマーク先 URL"
            />
            <Textarea
              placeholder="競合広告文"
              value={form.competitorCopy ?? ''}
              onChange={e => handleUpdate('competitorCopy', e.target.value || undefined)}
              aria-label="競合広告文"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              ペルソナ情報
            </CardTitle>
            <CardDescription>ペルソナの情報を入力してください</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="抽象的なデモグラフィック、ペルソナ"
              value={form.persona ?? ''}
              onChange={e => handleUpdate('persona', e.target.value || undefined)}
              aria-label="ペルソナ"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              サービス内容（5W2H）
            </CardTitle>
            <CardDescription>
              サービス内容を5W2Hの形式で入力してください。カンマ（,）または句点（、）区切りで複数入力可能です。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="強み"
              value={form.strength ?? ''}
              onChange={e => handleUpdate('strength', e.target.value || undefined)}
              aria-label="強み"
            />
            <Input
              placeholder="いつ（対応日時）"
              value={form.when ?? ''}
              onChange={e => handleUpdate('when', e.target.value || undefined)}
              aria-label="いつ（対応日時）"
            />
            <Input
              placeholder="どこで（地域）"
              value={form.where ?? ''}
              onChange={e => handleUpdate('where', e.target.value || undefined)}
              aria-label="どこで（地域）"
            />
            <Input
              placeholder="誰が（有資格者）"
              value={form.who ?? ''}
              onChange={e => handleUpdate('who', e.target.value || undefined)}
              aria-label="誰が（有資格者）"
            />
            <Input
              placeholder="なぜ（キャンペーン）"
              value={form.why ?? ''}
              onChange={e => handleUpdate('why', e.target.value || undefined)}
              aria-label="なぜ（キャンペーン）"
            />
            <Input
              placeholder="何を（サービス）"
              value={form.what ?? ''}
              onChange={e => handleUpdate('what', e.target.value || undefined)}
              aria-label="何を（サービス）"
            />
            <Input
              placeholder="どのように（問い合わせ方法）"
              value={form.how ?? ''}
              onChange={e => handleUpdate('how', e.target.value || undefined)}
              aria-label="どのように（問い合わせ方法）"
            />
            <Input
              placeholder="いくらで（最低価格）"
              value={form.price ?? ''}
              onChange={e => handleUpdate('price', e.target.value || undefined)}
              aria-label="いくらで（最低価格）"
            />
          </CardContent>
        </Card>

        <div className="flex justify-center pt-6">
          <Button type="submit" size="lg" disabled={isSaving} className="w-full max-w-md">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                事業者情報を保存
              </>
            )}
          </Button>
        </div>
      </form>

      <Dialog
        open={feedback.open}
        onOpenChange={open => {
          if (!open) {
            closeFeedback();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle
              className={feedback.variant === 'success' ? 'text-green-600' : 'text-red-600'}
            >
              {feedback.title}
            </DialogTitle>
            {feedback.message && <DialogDescription>{feedback.message}</DialogDescription>}
          </DialogHeader>
          <DialogFooter>
            <Button
              variant={feedback.variant === 'success' ? 'default' : 'destructive'}
              onClick={closeFeedback}
            >
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
