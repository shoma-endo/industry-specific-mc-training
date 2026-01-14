'use client';

import { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useLiffContext } from '@/components/LiffProvider';
import { saveBrief, getBrief } from '@/server/actions/brief.actions';
import {
  paymentEnum,
  type Payment,
  type BriefInput,
  type Service,
  type Profile,
} from '@/server/schemas/brief.schema';
import { Building2, Loader2, Save, Plus, Users, Package } from 'lucide-react';
import { toast } from 'sonner';
import { ServiceCard } from './ServiceCard';

interface BusinessInfoFormClientProps {
  initialData: BriefInput | null;
}

// Next.js 15ベストプラクティス: デフォルト値の定義
const DEFAULT_PROFILE: Profile = {
  company: '',
  address: '',
  ceo: '',
  hobby: '',
  staff: '',
  staffHobby: '',
  businessHours: '',
  holiday: '',
  tel: '',
  license: '',
  qualification: '',
  capital: '',
  email: '',
  payments: [],
  benchmarkUrl: '',
  competitorCopy: '',
};

const createEmptyService = (): Service => ({
  id: crypto?.randomUUID?.() || `service-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  name: '',
});

const createInitialState = (data?: Partial<BriefInput>): BriefInput => ({
  profile: {
    ...DEFAULT_PROFILE,
    ...data?.profile,
  },
  persona: data?.persona || '',
  services: data?.services || [createEmptyService()],
});

export default function BusinessInfoFormClient({ initialData }: BusinessInfoFormClientProps) {
  const { getAccessToken, isLoggedIn, isOwnerViewMode } = useLiffContext();
  const [form, setForm] = useState<BriefInput>(() => createInitialState(initialData || undefined));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const isReadOnly = isOwnerViewMode;

  // 初期データの読み込み（LIFFのトークンが必要な場合があるため）
  useEffect(() => {
    const loadData = async () => {
      try {
        if (!isLoggedIn) {
          setError('ログインが必要です');
          return;
        }

        // initialDataがある場合は一旦スキップするが、トークンが必要な処理があればここで
        if (initialData) {
          setForm(createInitialState(initialData));
          setIsLoading(false);
          return;
        }

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

  const handleUpdateProfile = useCallback(<K extends keyof Profile>(key: K, value: Profile[K]) => {
    setForm(prev => ({
      ...prev,
      profile: { ...prev.profile, [key]: value },
    }));
  }, []);

  const handleUpdatePersona = useCallback((value: string) => {
    setForm(prev => ({ ...prev, persona: value }));
  }, []);

  const handleUpdateService = useCallback((id: string, updates: Partial<Service>) => {
    setForm(prev => ({
      ...prev,
      services: prev.services.map(s => (s.id === id ? { ...s, ...updates } : s)),
    }));
  }, []);

  const handleAddService = useCallback(() => {
    setForm(prev => ({
      ...prev,
      services: [...prev.services, createEmptyService()],
    }));
  }, []);

  const handleRemoveService = useCallback((id: string) => {
    setForm(prev => {
      if (prev.services.length <= 1) return prev;
      const newServices = prev.services.filter(s => s.id !== id);
      return {
        ...prev,
        services: newServices,
      };
    });
  }, []);

  const handleTogglePayment = useCallback((payment: Payment) => {
    setForm(prev => {
      const currentPayments = prev.profile.payments || [];
      const newPayments = currentPayments.includes(payment)
        ? currentPayments.filter(p => p !== payment)
        : [...currentPayments, payment];
      return {
        ...prev,
        profile: { ...prev.profile, payments: newPayments },
      };
    });
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!isLoggedIn) {
        setError('ログインが必要です');
        return;
      }

      // バリデーション：サービス名が全て入力されているか
      const emptyServiceNameIndex = form.services.findIndex(s => !s.name.trim());
      if (emptyServiceNameIndex !== -1) {
        const msg = `サービス ${emptyServiceNameIndex + 1} の名称を入力してください。`;
        setError(msg);
        toast.error(msg);
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
          const errorMessage = saveError || '事業者情報の保存に失敗しました';
          setError(errorMessage);
          toast.error('保存に失敗しました', {
            description: errorMessage,
          });
          return;
        }

        toast.success('事業者情報を保存しました');
      } catch (err) {
        console.error('保存エラー:', err);
        setError('保存処理でエラーが発生しました');
        toast.error('保存に失敗しました', {
          description: '保存処理でエラーが発生しました',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [form, getAccessToken, isLoggedIn]
  );

  if (!isLoggedIn) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p>ログインが必要です</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">事業者情報を読み込んでいます...</p>
        </div>
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
        <fieldset disabled={isReadOnly} className="space-y-8">
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
                placeholder="会社名"
                value={form.profile.company ?? ''}
                onChange={e => handleUpdateProfile('company', e.target.value)}
                aria-label="会社名"
              />
              <Input
                placeholder="所在地"
                value={form.profile.address ?? ''}
                onChange={e => handleUpdateProfile('address', e.target.value)}
                aria-label="所在地"
              />
              <Input
                placeholder="代表者名"
                value={form.profile.ceo ?? ''}
                onChange={e => handleUpdateProfile('ceo', e.target.value)}
                aria-label="代表者名"
              />
              <Input
                placeholder="趣味・休日の過ごし方"
                value={form.profile.hobby ?? ''}
                onChange={e => handleUpdateProfile('hobby', e.target.value)}
                aria-label="趣味・休日の過ごし方"
              />
              <Input
                placeholder="スタッフ名"
                value={form.profile.staff ?? ''}
                onChange={e => handleUpdateProfile('staff', e.target.value)}
                aria-label="スタッフ名"
              />
              <Input
                placeholder="スタッフの趣味・休日の過ごし方"
                value={form.profile.staffHobby ?? ''}
                onChange={e => handleUpdateProfile('staffHobby', e.target.value)}
                aria-label="スタッフの趣味・休日の過ごし方"
              />
              <Input
                placeholder="営業時間"
                value={form.profile.businessHours ?? ''}
                onChange={e => handleUpdateProfile('businessHours', e.target.value)}
                aria-label="営業時間"
              />
              <Input
                placeholder="休日"
                value={form.profile.holiday ?? ''}
                onChange={e => handleUpdateProfile('holiday', e.target.value)}
                aria-label="休日"
              />
              <Input
                placeholder="電話番号"
                type="tel"
                value={form.profile.tel ?? ''}
                onChange={e => handleUpdateProfile('tel', e.target.value)}
                aria-label="電話番号"
              />
              <Input
                placeholder="許可番号"
                value={form.profile.license ?? ''}
                onChange={e => handleUpdateProfile('license', e.target.value)}
                aria-label="許可番号"
              />
              <Input
                placeholder="保有資格"
                value={form.profile.qualification ?? ''}
                onChange={e => handleUpdateProfile('qualification', e.target.value)}
                aria-label="保有資格"
              />
              <Input
                placeholder="資本金"
                value={form.profile.capital ?? ''}
                onChange={e => handleUpdateProfile('capital', e.target.value)}
                aria-label="資本金"
              />
              <Input
                placeholder="メールアドレス"
                type="email"
                value={form.profile.email ?? ''}
                onChange={e => handleUpdateProfile('email', e.target.value)}
                aria-label="メールアドレス"
              />

              <div>
                <p className="mb-2 font-medium">決済方法</p>
                <div role="group" aria-labelledby="payment-methods">
                  {paymentEnum.options.map(payment => (
                    <div key={payment} className="flex items-center space-x-2 mb-1">
                      <Checkbox
                        checked={(form.profile.payments || []).includes(payment as Payment)}
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
                type="url"
                value={form.profile.benchmarkUrl ?? ''}
                onChange={e => handleUpdateProfile('benchmarkUrl', e.target.value)}
                aria-label="ベンチマーク先 URL"
              />
              <Textarea
                placeholder="競合広告文"
                value={form.profile.competitorCopy ?? ''}
                onChange={e => handleUpdateProfile('competitorCopy', e.target.value)}
                aria-label="競合広告文"
              />
            </CardContent>
          </Card>

          {/* ペルソナ情報セクション */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                ペルソナ情報
              </CardTitle>
              <CardDescription>ペルソナの情報を入力してください</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="抽象的なデモグラフィック、ペルソナ"
                value={form.persona ?? ''}
                onChange={e => handleUpdatePersona(e.target.value)}
                aria-label="ペルソナ"
              />
            </CardContent>
          </Card>

          {/* サービス登録セクション */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                サービス内容（5W2H）
              </CardTitle>
              <CardDescription>
                サービス内容を5W2Hの形式で入力してください。複数のサービスを登録可能です。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-8">
                {form.services.map((service, index) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    index={index}
                    onUpdate={handleUpdateService}
                    onRemove={handleRemoveService}
                    isRemoveDisabled={form.services.length <= 1}
                    isReadOnly={isReadOnly}
                  />
                ))}
              </div>

              {!isReadOnly && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={handleAddService}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  サービスを追加する
                </Button>
              )}
            </CardContent>
          </Card>

          {/* 保存ボタン */}
          <div className="flex justify-center pt-6">
            <Button
              type="submit"
              size="lg"
              disabled={isSaving || isReadOnly}
              className="w-full max-w-md"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  事業者情報を保存
                </>
              )}
            </Button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
