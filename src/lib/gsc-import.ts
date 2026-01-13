type QuerySummary = {
  fetchedRows: number;
  keptRows: number;
  dedupedRows: number;
  fetchErrorPages: number;
  skipped: {
    missingKeys: number;
    invalidUrl: number;
    emptyQuery: number;
    zeroMetrics: number;
  };
  hitLimit: boolean;
};

export const getQueryImportToastMessage = (summary: QuerySummary) => {
  if (summary.fetchErrorPages > 0) {
    return {
      type: 'warning' as const,
      message: `取得失敗ページ: ${summary.fetchErrorPages}（一部欠損の可能性）`,
    };
  }
  return {
    type: 'success' as const,
    message: `取得完了: ${summary.dedupedRows}件（保存対象 ${summary.keptRows}件）`,
  };
};

export const getQuerySummaryLabels = (summary: QuerySummary) => ({
  fetched: `取得行数: ${summary.fetchedRows}`,
  kept: `保存対象: ${summary.keptRows}`,
  deduped: `集約後: ${summary.dedupedRows}`,
  fetchErrorPages: `取得失敗ページ: ${summary.fetchErrorPages}`,
  missingKeys: `キー欠損: ${summary.skipped.missingKeys}`,
  invalidUrl: `URL正規化失敗: ${summary.skipped.invalidUrl}`,
  emptyQuery: `クエリ空: ${summary.skipped.emptyQuery}`,
  zeroMetrics: `0クリック/0表示: ${summary.skipped.zeroMetrics}`,
  hitLimit: summary.hitLimit
    ? '取得上限に到達した可能性があります。期間を短くして再インポートしてください。'
    : null,
});
