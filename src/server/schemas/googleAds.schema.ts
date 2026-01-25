import { z } from 'zod';

/**
 * 日付形式（YYYY-MM-DD）のバリデーション
 */
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: '日付は YYYY-MM-DD 形式で指定してください',
});

/**
 * Google Ads カスタマー ID（ハイフンなし 10桁）のバリデーション
 */
const customerIdSchema = z.string().regex(/^\d{10}$/, {
  message: 'カスタマー ID は 10桁の数字で指定してください',
});

/**
 * キーワード指標取得の入力スキーマ
 */
export const getKeywordMetricsSchema = z
  .object({
    customerId: customerIdSchema,
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    campaignIds: z.array(z.string()).optional(),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return start <= end;
    },
    {
      message: '開始日は終了日より前である必要があります',
    }
  );

export type GetKeywordMetricsSchemaInput = z.infer<typeof getKeywordMetricsSchema>;

/**
 * API クエリパラメータ用のスキーマ（GET リクエスト向け）
 */
export const keywordMetricsQuerySchema = z.object({
  customerId: customerIdSchema,
  startDate: dateStringSchema,
  endDate: dateStringSchema,
});

export type KeywordMetricsQueryInput = z.infer<typeof keywordMetricsQuerySchema>;
