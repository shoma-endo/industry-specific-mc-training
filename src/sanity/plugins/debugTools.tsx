import React from 'react';
import { Card, Stack, Text, Button } from '@sanity/ui';
import { BugIcon, ControlsIcon } from '@sanity/icons';

// デバッグツールコンポーネント
function DebugToolsPanel() {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const openDebugPage = (path: string) => {
    window.open(`${baseUrl}${path}`, '_blank');
  };

  return (
    <Card padding={4}>
      <Stack space={4}>
        <Text size={3} weight="bold">
          🛠️ デバッグツール
        </Text>

        <Text size={1} muted>
          開発・テスト用のデバッグページにアクセスできます
        </Text>

        <Stack space={3}>
          {/* Draft Mode デバッグ */}
          <Card padding={3} border>
            <Stack space={3}>
              <Text size={2} weight="semibold">
                Draft Mode
              </Text>
              <Text size={1} muted>
                プレビューモードの管理・切り替え
              </Text>
              <Button
                mode="default"
                tone="primary"
                text="Draft Mode デバッグページを開く"
                onClick={() => openDebugPage('/debug/draft-mode')}
                icon={ControlsIcon}
              />
            </Stack>
          </Card>

          {/* WordPress エクスポート デバッグ */}
          <Card padding={3} border>
            <Stack space={3}>
              <Text size={2} weight="semibold">
                WordPress エクスポート
              </Text>
              <Text size={1} muted>
                WordPressへのエクスポート機能テスト
              </Text>
              <Button
                mode="default"
                tone="primary"
                text="WordPress エクスポート デバッグページを開く"
                onClick={() => openDebugPage('/debug/wordpress-export')}
                icon={BugIcon}
              />
            </Stack>
          </Card>
        </Stack>

        <Card padding={3} tone="caution">
          <Text size={1}>
            💡 <strong>使い方:</strong>
            <br />
            • Draft Mode: Sanityの下書きコンテンツのプレビュー管理
            <br />
            • WordPress エクスポート: WordPressへの投稿作成・更新テスト
            <br />• 新しいタブで開かれるため、Studio作業を継続できます
          </Text>
        </Card>
      </Stack>
    </Card>
  );
}

// ツール定義（公式ドキュメント準拠）
export const debugTool = {
  title: 'デバッグツール',
  name: 'debug-tools',
  icon: BugIcon,
  component: DebugToolsPanel,
};
