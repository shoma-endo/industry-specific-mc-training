'use client';

import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface SuggestionDataReadinessProps {
  annotation: {
    id: string;
    wp_post_id: number | null;
    wp_post_title: string | null;
    wp_excerpt?: string | null;
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
  // wp_post_id があれば、ステージ1と3はWordPressから動的取得可能
  const hasWpPostId = annotation.wp_post_id !== null && annotation.wp_post_id !== undefined;

  // 各ステージのデータ要件
  const requirements: DataRequirement[] = [
    // ステージ1: wp_post_id がない場合のみ、キャッシュされたタイトル/説明文をチェック
    ...(hasWpPostId
      ? []
      : [
          {
            stage: 1,
            label: 'スニペット（タイトル/説明文）',
            fields: [
              { name: 'wp_post_title', displayName: 'WPタイトル', value: annotation.wp_post_title },
              {
                name: 'wp_excerpt',
                displayName: 'WP抜粋/説明文',
                value: annotation.wp_excerpt ?? null,
              },
            ],
            requiresAll: false, // どちらか1つでもあればOK
          },
        ]),
    {
      stage: 2,
      label: '書き出し案',
      fields: [
        { name: 'opening_proposal', displayName: '書き出し案', value: annotation.opening_proposal },
      ],
      requiresAll: true,
    },
    // ステージ3: wp_post_id がない場合のみ、キャッシュされた本文をチェック
    ...(hasWpPostId
      ? []
      : [
          {
            stage: 3,
            label: '記事本文',
            fields: [
              {
                name: 'wp_content_text',
                displayName: '記事本文（キャッシュ）',
                value: annotation.wp_content_text,
              },
            ],
            requiresAll: true, // wp_post_id がない場合はキャッシュ本文が必須
          },
        ]),
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
      <div className="flex gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <AlertTitle className="text-amber-900 font-semibold text-base">
            改善提案に必要なデータが不足しています
          </AlertTitle>
          <AlertDescription className="text-amber-800 space-y-3">
            <p className="text-sm">
              以下のデータが未登録のため、該当の改善提案がスキップされます。評価を実行する前にデータを登録してください。
            </p>
            <ul className="space-y-2 list-none">
              {missingRequirements.map(req => {
                const missingFields = req.fields.filter(
                  field => !field.value || field.value.trim().length === 0
                );
                return (
                  <li key={req.stage} className="flex items-start gap-2 text-sm">
                    <span className="text-amber-600 mt-0.5 flex-shrink-0">•</span>
                    <span>
                      <span className="font-medium">{req.label}</span>
                      {missingFields.length > 0 && req.requiresAll && (
                        <span className="text-amber-700 ml-2">
                          （{missingFields.map(f => f.displayName).join('、')}が必要）
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
}
