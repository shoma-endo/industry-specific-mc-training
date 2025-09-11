'use client';

import * as React from 'react';
import FieldConfigurator from '@/components/FieldConfigurator';
import AnnotationEditButton from '@/components/AnnotationEditButton';
import TruncatedText from '@/components/TruncatedText';

type PostRow = {
  id: number | string;
  date?: string | undefined;
  title?: string | undefined;
  link?: string | undefined;
  categories?: number[] | undefined;
  categoryNames?: string[] | undefined;
  excerpt?: string | undefined;
};

type Annotation = {
  wp_post_id: number;
  main_kw?: string | null;
  kw?: string | null;
  impressions?: string | null;
  persona?: string | null;
  needs?: string | null;
  goal?: string | null;
  memo?: string | null;
};

type Props = {
  posts: PostRow[];
  annotations: Annotation[];
};

const columns = [
  { id: 'main_kw', label: '主軸kw' },
  { id: 'kw', label: 'kw（参考）' },
  { id: 'impressions', label: '表示回数' },
  { id: 'persona', label: 'デモグラ・ペルソナ' },
  { id: 'needs', label: 'ニーズ' },
  { id: 'goal', label: 'ゴール' },
  { id: 'categories', label: 'カテゴリ' },
  { id: 'date', label: '公開日' },
  { id: 'title', label: 'タイトル' },
  { id: 'url', label: 'URL' },
  { id: 'memo', label: 'メモ' },
  { id: 'rank', label: '順位' },
];

export default function AnalyticsTable({ posts, annotations }: Props) {
  return (
    <FieldConfigurator
      storageKey="analytics.visibleColumns"
      columns={columns}
      hideTrigger
      triggerId="analytics-field-config-trigger"
    >
      {visibleSet => (
        <div className="w-full overflow-x-auto">
          <table className="min-w-[2200px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {visibleSet.has('main_kw') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[180px]">
                    主軸kw
                  </th>
                )}
                {visibleSet.has('kw') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[180px]">
                    kw（参考）
                  </th>
                )}
                {visibleSet.has('impressions') && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                    表示回数
                  </th>
                )}
                {visibleSet.has('persona') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[220px]">
                    デモグラ・ペルソナ
                  </th>
                )}
                {visibleSet.has('needs') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[220px]">
                    ニーズ
                  </th>
                )}
                {visibleSet.has('goal') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[220px]">
                    ゴール
                  </th>
                )}
                {visibleSet.has('categories') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[200px]">
                    カテゴリ
                  </th>
                )}
                {visibleSet.has('date') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                    公開日
                  </th>
                )}
                {visibleSet.has('title') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[360px]">
                    タイトル
                  </th>
                )}
                {visibleSet.has('url') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[300px]">
                    URL
                  </th>
                )}
                {visibleSet.has('memo') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[220px]">
                    メモ
                  </th>
                )}
                {visibleSet.has('rank') && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[100px]">
                    順位
                  </th>
                )}
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[100px]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {posts.map(p => {
                const a = annotations.find(
                  x => x.wp_post_id === (typeof p.id === 'string' ? parseInt(p.id, 10) : p.id)
                );
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    {visibleSet.has('main_kw') && (
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {a?.main_kw ? <TruncatedText text={a.main_kw} lines={2} /> : '—'}
                      </td>
                    )}
                    {visibleSet.has('kw') && (
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {a?.kw ? <TruncatedText text={a.kw} lines={2} /> : '—'}
                      </td>
                    )}
                    {visibleSet.has('impressions') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {a?.impressions ?? '—'}
                      </td>
                    )}
                    {visibleSet.has('persona') && (
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {a?.persona ? <TruncatedText text={a.persona} lines={3} /> : '—'}
                      </td>
                    )}
                    {visibleSet.has('needs') && (
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {a?.needs ? <TruncatedText text={a.needs} lines={3} /> : '—'}
                      </td>
                    )}
                    {visibleSet.has('goal') && (
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {a?.goal ? <TruncatedText text={a.goal} lines={3} /> : '—'}
                      </td>
                    )}
                    {visibleSet.has('categories') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {p.categoryNames && p.categoryNames.length > 0
                          ? p.categoryNames.join(', ')
                          : '—'}
                      </td>
                    )}
                    {visibleSet.has('date') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {p.date ? new Date(p.date).toLocaleDateString('ja-JP') : '—'}
                      </td>
                    )}
                    {visibleSet.has('title') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {p.title || '（無題）'}
                      </td>
                    )}
                    {visibleSet.has('url') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                        {p.link ? (
                          <a
                            href={p.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            {p.link}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    {visibleSet.has('memo') && (
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {a?.memo ? <TruncatedText text={a.memo} lines={3} /> : '—'}
                      </td>
                    )}
                    {visibleSet.has('rank') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        —
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <AnnotationEditButton
                        wpPostId={typeof p.id === 'string' ? parseInt(p.id, 10) : p.id}
                        canonicalUrl={p.link ?? null}
                        initial={{
                          main_kw: a?.main_kw ?? null,
                          kw: a?.kw ?? null,
                          impressions: a?.impressions ?? null,
                          persona: a?.persona ?? null,
                          needs: a?.needs ?? null,
                          goal: a?.goal ?? null,
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </FieldConfigurator>
  );
}
