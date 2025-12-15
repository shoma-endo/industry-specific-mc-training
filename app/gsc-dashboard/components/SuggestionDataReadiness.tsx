'use client';

import { AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

interface SuggestionDataReadinessProps {
  annotation: {
    ads_headline: string | null;
    ads_description: string | null;
    opening_proposal: string | null;
    wp_content_text: string | null;
    persona: string | null;
    needs: string | null;
  };
}

interface DataRequirement {
  stage: number;
  label: string;
  fields: Array<{
    name: string;
    displayName: string;
    value: string | null;
  }>;
  requiresAll: boolean; // true: 全て必要, false: いずれか1つ
}

export function SuggestionDataReadiness({ annotation }: SuggestionDataReadinessProps) {
  // 各ステージのデータ要件
  const requirements: DataRequirement[] = [
    {
      stage: 1,
      label: '広告タイトル / 広告説明文',
      fields: [
        { name: 'ads_headline', displayName: '広告タイトル', value: annotation.ads_headline },
        { name: 'ads_description', displayName: '広告説明文', value: annotation.ads_description },
      ],
      requiresAll: false, // どちらか1つでもあればOK
    },
    {
      stage: 2,
      label: '書き出し案',
      fields: [
        { name: 'opening_proposal', displayName: '書き出し案', value: annotation.opening_proposal },
      ],
      requiresAll: true,
    },
    {
      stage: 3,
      label: '記事本文',
      fields: [
        { name: 'wp_content_text', displayName: '記事本文', value: annotation.wp_content_text },
      ],
      requiresAll: true,
    },
    {
      stage: 4,
      label: 'デモグラ・ペルソナ / ニーズ',
      fields: [
        { name: 'persona', displayName: 'デモグラ・ペルソナ', value: annotation.persona },
        { name: 'needs', displayName: 'ニーズ', value: annotation.needs },
      ],
      requiresAll: false, // どちらか1つでもあればOK
    },
  ];

  // 各ステージの充足状況を判定
  const checkStageReadiness = (requirement: DataRequirement): boolean => {
    if (requirement.requiresAll) {
      return requirement.fields.every(field => field.value && field.value.trim().length > 0);
    } else {
      return requirement.fields.some(field => field.value && field.value.trim().length > 0);
    }
  };

  const missingRequirements = requirements.filter(req => !checkStageReadiness(req));

  // 全てのデータが揃っている場合は何も表示しない
  if (missingRequirements.length === 0) {
    return null;
  }

  return (
    <Alert className="bg-amber-50 border-amber-200">
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-900 font-semibold">
        改善提案に必要なデータが不足しています
      </AlertTitle>
      <AlertDescription className="text-amber-800 space-y-3 mt-2">
        <p className="text-sm">
          以下のデータが未登録のため、該当の改善提案がスキップされます。評価を実行する前にデータを登録してください。
        </p>
        <div className="space-y-2">
          {missingRequirements.map(req => {
            const missingFields = req.fields.filter(
              field => !field.value || field.value.trim().length === 0
            );
            return (
              <div key={req.stage} className="flex items-start gap-2 text-sm">
                <span className="text-amber-600 mt-0.5">•</span>
                <div className="flex-1">
                  <span className="font-medium">{req.label}</span>
                  {missingFields.length > 0 && (
                    <span className="text-amber-700 ml-2">
                      {req.requiresAll
                        ? `（${missingFields.map(f => f.displayName).join('、')}が必要）`
                        : `（${missingFields.map(f => f.displayName).join(' または ')}のいずれか）`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="pt-2">
          <Link
            href="/analytics"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-900 hover:text-amber-700 underline underline-offset-4 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            チャットから登録する
          </Link>
        </div>
      </AlertDescription>
    </Alert>
  );
}
