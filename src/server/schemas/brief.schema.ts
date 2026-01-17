import { z } from 'zod';

export const paymentEnum = z.enum([
  '現金',
  '銀行振込',
  'クレジットカード(VISA)',
  'クレジットカード(Master)',
  'クレジットカード(AMEX)',
  'クレジットカード(Diners)',
  'クレジットカード(JCB)',
  '分割払い',
]);

// 早期リターンを使用したカスタムバリデーター
const createOptionalUrlValidator = () =>
  z
    .string()
    .optional()
    .refine(
      val => {
        if (!val || val === '') return true;
        return z.string().url().safeParse(val).success;
      },
      {
        message: '有効なURLを入力してください',
      }
    )
    .transform(val => {
      if (val === '') return undefined;
      return val;
    });

const createOptionalEmailValidator = () =>
  z
    .string()
    .optional()
    .refine(
      val => {
        if (!val || val === '') return true;
        return z.string().email().safeParse(val).success;
      },
      {
        message: '有効なメールアドレスを入力してください',
      }
    )
    .transform(val => {
      if (val === '') return undefined;
      return val;
    });

export const serviceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'サービス名は必須です'),
  strength: z.string().optional(),
  when: z.string().optional(),
  where: z.string().optional(),
  who: z.string().optional(),
  why: z.string().optional(),
  what: z.string().optional(),
  how: z.string().optional(),
  price: z.string().optional(),
});

export const profileSchema = z.object({
  company: z.string().optional(),
  address: z.string().optional(),
  ceo: z.string().optional(),
  hobby: z.string().optional(),
  staff: z.string().optional(),
  staffHobby: z.string().optional(),
  businessHours: z.string().optional(),
  holiday: z.string().optional(),
  tel: z.string().optional(),
  license: z.string().optional(),
  qualification: z.string().optional(),
  capital: z.string().optional(),
  email: createOptionalEmailValidator(),
  payments: z.array(paymentEnum).optional(),
  benchmarkUrl: createOptionalUrlValidator(),
  competitorCopy: z.string().optional(),
});

export const briefInputSchema = z.object({
  profile: profileSchema,
  persona: z.string().optional(),
  services: z.array(serviceSchema).min(1, '最低1つのサービスが必要です'),
});

export type Service = z.infer<typeof serviceSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type BriefInput = z.infer<typeof briefInputSchema>;
export type Payment = z.infer<typeof paymentEnum>;
