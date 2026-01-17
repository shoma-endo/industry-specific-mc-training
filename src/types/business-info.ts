import type { Payment } from '@/server/schemas/brief.schema';

export type { BriefInput, Payment, Profile, Service } from '@/server/schemas/brief.schema';

/**
 * レガシーシステムとの互換性のためのブリーフ入力インターフェース。
 * 新規開発では BriefInput の使用を推奨します。
 * @deprecated 将来的に BriefInput への移行を予定
 */
export interface LegacyBriefInput {
  service?: string;
  company?: string;
  address?: string;
  ceo?: string;
  hobby?: string;
  staff?: string;
  staffHobby?: string;
  businessHours?: string;
  holiday?: string;
  tel?: string;
  license?: string;
  qualification?: string;
  capital?: string;
  email?: string;
  payments?: Payment[];
  benchmarkUrl?: string;
  competitorCopy?: string;
  persona?: string;
  strength?: string;
  when?: string;
  where?: string;
  who?: string;
  why?: string;
  what?: string;
  how?: string;
  price?: string;
}
