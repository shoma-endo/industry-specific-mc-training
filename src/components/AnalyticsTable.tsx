'use client';

import * as React from 'react';
import FieldConfigurator from '@/components/FieldConfigurator';
import AnnotationEditButton from '@/components/AnnotationEditButton';
import TruncatedText from '@/components/TruncatedText';
import { ANALYTICS_COLUMNS } from '@/lib/constants';

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
  session_id?: string | null;
  canonical_url?: string | null;
};

type Props = {
  posts: PostRow[];
  annotations: Annotation[];
};

export default function AnalyticsTable({ posts, annotations }: Props) {
  // 紐付け判定用に投稿IDセットを作成
  const postIdSet = React.useMemo(() => {
    const set = new Set<number>();
    for (const p of posts) {
      const idNum = typeof p.id === 'string' ? parseInt(p.id, 10) : (p.id as number);
      if (Number.isFinite(idNum)) set.add(idNum);
    }
    return set;
  }, [posts]);

  // 未紐付け（wp_post_idが無い、または取得済み投稿に存在しない）注釈
  const unlinkedAnnotations = React.useMemo(() => {
    return annotations.filter(a => {
      if (a == null) return false;
      if (a.wp_post_id == null) return true;
      return !postIdSet.has(a.wp_post_id);
    });
  }, [annotations, postIdSet]);

  const rows = React.useMemo(() => {
    const list: Array<
      | { type: 'post'; post: PostRow; a: Annotation | undefined }
      | { type: 'unlinked'; a: Annotation }
    > = [];
    for (const p of posts) {
      const a = annotations.find(
        x => x.wp_post_id === (typeof p.id === 'string' ? parseInt(p.id, 10) : (p.id as number))
      );
      list.push({ type: 'post', post: p, a });
    }
    for (const a of unlinkedAnnotations) {
      list.push({ type: 'unlinked', a });
    }
    return list;
  }, [posts, annotations, unlinkedAnnotations]);

  return (
    <FieldConfigurator
      storageKey="analytics.visibleColumns"
      columns={ANALYTICS_COLUMNS}
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
              {rows.map((row, idx) => {
                if (row.type === 'post') {
                  const p = row.post;
                  const a = row.a;
                  return (
                    <tr key={`post:${p.id}`} className="hover:bg-gray-50">
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
                          {(a?.canonical_url ?? p.link) ? (
                            <a
                              href={(a?.canonical_url ?? p.link) as string}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline"
                            >
                              {a?.canonical_url ?? p.link}
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
                }
                const a = row.a;
                return (
                  <tr key={`session:${a.session_id ?? idx}`} className="hover:bg-gray-50">
                    {visibleSet.has('main_kw') && (
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {a.main_kw ? <TruncatedText text={a.main_kw} lines={2} /> : '—'}
                      </td>
                    )}
                    {visibleSet.has('kw') && (
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {a.kw ? <TruncatedText text={a.kw} lines={2} /> : '—'}
                      </td>
                    )}
                    {visibleSet.has('impressions') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {a.impressions ?? '—'}
                      </td>
                    )}
                    {visibleSet.has('persona') && (
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {a.persona ? <TruncatedText text={a.persona} lines={3} /> : '—'}
                      </td>
                    )}
                    {visibleSet.has('needs') && (
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {a.needs ? <TruncatedText text={a.needs} lines={3} /> : '—'}
                      </td>
                    )}
                    {visibleSet.has('goal') && (
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {a.goal ? <TruncatedText text={a.goal} lines={3} /> : '—'}
                      </td>
                    )}
                    {visibleSet.has('categories') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">—</td>
                    )}
                    {visibleSet.has('date') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">—</td>
                    )}
                    {visibleSet.has('title') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        （未紐付け）
                      </td>
                    )}
                    {visibleSet.has('url') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                        {a.canonical_url ? (
                          <a
                            href={a.canonical_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            {a.canonical_url}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    )}
                    {visibleSet.has('memo') && (
                      <td className="px-6 py-4 text-sm text-gray-500">—</td>
                    )}
                    {visibleSet.has('rank') && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        —
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <AnnotationEditButton
                        sessionId={a.session_id ?? ''}
                        canonicalUrl={null}
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
