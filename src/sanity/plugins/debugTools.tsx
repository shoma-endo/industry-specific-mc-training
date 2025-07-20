import React from 'react';
import { Card, Stack, Text } from '@sanity/ui';
import { BugIcon } from '@sanity/icons';

// デバッグツールコンポーネント
function DebugToolsPanel() {
  return (
    <Card padding={4}>
      <Stack space={4}>
        <Text size={3} weight="bold">
          🛠️ デバッグツール
        </Text>

        <Text size={1} muted>
          デバッグページは現在利用できません。
        </Text>

        <Card padding={3} tone="caution">
          <Text size={1}>
            💡 <strong>注意:</strong>
            <br />
            デバッグ機能は開発中です。実際のデバッグページが作成された際に、ここに表示されます。
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
