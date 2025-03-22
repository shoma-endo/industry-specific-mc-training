export interface TodoItem {
  id: number;
  text: string;
  completed: boolean;
  userId?: string; // LINEのユーザーID
  createdAt: number; // 作成日時（タイムスタンプ）
} 