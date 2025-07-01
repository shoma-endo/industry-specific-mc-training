'use client'
import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'

// LiffProvider をクライアントでのみ読み込む
const LiffProvider = dynamic(
  () => import('@/components/LiffProvider').then((m) => m.LiffProvider),
  { ssr: false }
)

// useLiffContextを再エクスポート
export { useLiffContext } from '@/components/LiffProvider';

export function ClientLiffProvider({
  initialize,
  children,
}: {
  initialize: boolean
  children: ReactNode
}) {
  return <LiffProvider initialize={initialize}>{children}</LiffProvider>
}
