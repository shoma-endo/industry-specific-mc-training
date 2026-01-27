import { z } from 'zod';

/**
 * 日付形式（YYYY-MM-DD）のバリデーション
 * - 形式チェック（正規表現）
 * - 実在する日付かをチェック（例: 2024-02-30 は無効）
 */
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: '日付は YYYY-MM-DD 形式で指定してください',
  })
  .refine(
    (value) => {
      const parts = value.split('-').map(Number);
      const y = parts[0];
      const m = parts[1];
      const d = parts[2];

      if (y === undefined || m === undefined || d === undefined) return false;

      const date = new Date(y, m - 1, d);

      return (
        date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
      );
    },
    {
      message: '無効な日付です',
    }
  );

/**
 * Google Ads カスタマー ID（ハイフンなし 10桁）のバリデーション
 */
const customerIdSchema = z.string().regex(/^\d{10}$/, {
  message: 'カスタマー ID は 10桁の数字で指定してください',
});

/**
 * キャンペーン ID（数値のみの文字列）のバリデーション
 */
const campaignIdSchema = z.string().regex(/^\d+$/, {
  message: 'キャンペーン ID は数値のみで指定してください',
});

/**
 * キーワード指標取得の入力スキーマ
 */
export const getKeywordMetricsSchema = z
  .object({
    customerId: customerIdSchema,
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    campaignIds: z.array(campaignIdSchema).optional(),
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
