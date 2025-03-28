# 第３章 LIFF認証について

## 3.1 LIFFとは

LIFF（LINE Front-end Framework）は、LINEが提供するWebアプリケーションプラットフォームです。LIFFを使用すると、LINE内でWebアプリケーションを実行し、LINEのユーザー情報やAPIにアクセスすることができます。

LIFFの主な特徴：
- LINE内でWebアプリケーションを実行
- LINEユーザー情報へのアクセス
- LINEのネイティブ機能（メッセージ送信、QRコードスキャンなど）の利用
- 外部ブラウザでも動作可能

## 3.2 LIFF SDKの初期化

LIFF-Templateプロジェクトでは、`LiffProvider`コンポーネントを使用してLIFF SDKを初期化しています。

### 3.2.1 LiffProviderコンポーネント

`src/components/LiffProvider.tsx`ファイルには、LIFF SDKを初期化し、アプリケーション全体にLIFF機能を提供するコンポーネントが定義されています：

```tsx
'use client';

import { ReactNode, createContext, useEffect, useState } from 'react';
import { Liff } from '@line/liff';
import { setUserId } from '@/app/actions';

export const LiffContext = createContext<{
  liff: Liff | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  error: Error | null;
}>({
  liff: null,
  isLoggedIn: false,
  isLoading: true,
  error: null,
});

export default function LiffProvider({ children }: { children: ReactNode }) {
  const [liff, setLiff] = useState<Liff | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initializeLiff = async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) {
          throw new Error('LIFF ID is required');
        }

        const { liff } = await import('@line/liff');
        await liff.init({ liffId });
        
        if (liff.isLoggedIn()) {
          setIsLoggedIn(true);
          const profile = await liff.getProfile();
          await setUserId(profile.userId);
        }
        
        setLiff(liff);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to initialize LIFF'));
        console.error('LIFF initialization failed', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeLiff();
  }, []);

  return (
    <LiffContext.Provider value={{ liff, isLoggedIn, isLoading, error }}>
      {children}
    </LiffContext.Provider>
  );
}
```

このコンポーネントは、以下の機能を提供します：
- LIFF SDKの初期化
- ログイン状態の管理
- ユーザープロフィールの取得
- ユーザーIDのサーバーへの送信

### 3.2.2 環境変数の設定

LIFF SDKを初期化するには、LIFF IDが必要です。LIFF IDは、LINEデベロッパーコンソールで作成したLIFFアプリケーションに割り当てられる一意の識別子です。

LIFF-Templateプロジェクトでは、LIFF IDを環境変数として設定します：

```
NEXT_PUBLIC_LIFF_ID=your_liff_id_here
NEXT_PUBLIC_LIFF_CHANNEL_ID=your_channel_id_here
```

これらの環境変数は、`src/env.ts`ファイルで型安全に定義されています。

## 3.3 useLiffフック

`src/hooks/useLiff.ts`ファイルには、LIFF機能にアクセスするためのカスタムReact Hookが定義されています：

```typescript
'use client';

import { useContext, useEffect, useState } from 'react';
import { LiffContext } from '@/components/LiffProvider';

export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export const useLiff = () => {
  const { liff, isLoggedIn, isLoading, error } = useContext(LiffContext);
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const login = () => {
    if (!liff) return;
    liff.login();
  };

  const logout = () => {
    if (!liff) return;
    liff.logout();
    window.location.reload();
  };

  const getProfile = async (): Promise<LiffProfile | null> => {
    if (!liff || !liff.isLoggedIn()) return null;
    
    try {
      setProfileLoading(true);
      const profile = await liff.getProfile();
      const liffProfile: LiffProfile = {
        userId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        statusMessage: profile.statusMessage,
      };
      setProfile(liffProfile);
      return liffProfile;
    } catch (error) {
      console.error('Failed to get profile', error);
      return null;
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn && liff && !profile && !profileLoading) {
      getProfile();
    }
  }, [isLoggedIn, liff, profile, profileLoading]);

  return {
    liff,
    isLoggedIn,
    isLoading,
    error,
    profile,
    profileLoading,
    login,
    logout,
    getProfile,
  };
};
```

このフックは、以下の機能を提供します：
- LIFF SDKへのアクセス
- ログイン/ログアウト機能
- ユーザープロフィールの取得と管理
- ローディング状態とエラー状態の管理

## 3.4 サーバーサイド認証

LIFF-Templateプロジェクトでは、クライアントサイドの認証に加えて、サーバーサイドでもLINEトークンの検証を行っています。

### 3.4.1 ログインアクション

`src/server/handler/actions/login.actions.ts`ファイルには、LINEトークンを検証し、ユーザープロフィールを取得するサーバーアクションが定義されています：

```typescript
'use server';

import { cookies } from 'next/headers';
import { LineAuthService } from '@/server/services/lineAuthService';
import { LiffProfile } from '@/hooks/useLiff';

const lineAuthService = new LineAuthService();

export const verifyToken = async (accessToken: string): Promise<void> => {
  try {
    await lineAuthService.verifyLineToken(accessToken);
  } catch (error) {
    console.error('Token verification failed:', error);
    throw new Error('Token verification failed');
  }
};

export const getProfile = async (accessToken: string): Promise<LiffProfile> => {
  try {
    return await lineAuthService.getLineProfile(accessToken);
  } catch (error) {
    console.error('Failed to get profile:', error);
    throw new Error('Failed to get profile');
  }
};

export const setUserId = async (userId: string): Promise<void> => {
  cookies().set('userId', userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
};
```

これらのサーバーアクションは、以下の機能を提供します：
- LINEアクセストークンの検証
- LINEユーザープロフィールの取得
- ユーザーIDのクッキーへの保存

### 3.4.2 LINE認証サービス

`src/server/services/lineAuthService.ts`ファイルには、LINEトークンの検証とユーザープロフィールの取得を行うサービスが定義されています：

```typescript
import { env } from '@/env';
import { LiffProfile } from '@/hooks/useLiff';

export class LineAuthService {
  verifyLineToken = async (accessToken: string): Promise<void> => {
    try {
      const channelId = env.NEXT_PUBLIC_LIFF_CHANNEL_ID;
      const response = await fetch(
        `https://api.line.me/oauth2/v2.1/verify?access_token=${accessToken}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        const data: { error_description: string; error: string } = await response.json();
        throw new Error(`[LINE Token Verification] ${data.error}: ${data.error_description}`);
      }

      const data: { client_id: string; expires_in: number } = await response.json();
      if (data.client_id !== channelId) {
        throw new Error(`Line client_id does not match:liffID : ${channelId}  client_id : ${data.client_id}`);
      }

      if (data.expires_in < 0) {
        throw new Error(`Line access token is expired: ${data.expires_in}`);
      }
    } catch (error) {
      console.error('[LINE Auth Service] verifyLineToken error:', error);
      throw error;
    }
  };

  getLineProfile = async (accessToken: string): Promise<LiffProfile> => {
    try {
      const response = await fetch('https://api.line.me/v2/profile', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get LINE profile: ${response.status}`);
      }

      const data = await response.json();
      return {
        userId: data.userId,
        displayName: data.displayName,
        pictureUrl: data.pictureUrl,
        statusMessage: data.statusMessage,
      };
    } catch (error) {
      console.error('[LINE Auth Service] getLineProfile error:', error);
      throw error;
    }
  };
}
```

このサービスは、以下の機能を提供します：
- LINEアクセストークンの検証（有効期限、クライアントIDの確認）
- LINEユーザープロフィールの取得（ユーザーID、表示名、プロフィール画像、ステータスメッセージ）

## 3.5 認証フロー

LIFF-Templateプロジェクトの認証フローは、以下のステップで構成されています：

1. **LIFF初期化**：
   - アプリケーション起動時に`LiffProvider`コンポーネントがLIFF SDKを初期化
   - 環境変数からLIFF IDを取得
   - LIFF SDKの初期化処理を実行

2. **ログイン状態の確認**：
   - LIFF SDKの`isLoggedIn()`メソッドを使用してログイン状態を確認
   - ログイン済みの場合、ユーザープロフィールを取得
   - ユーザーIDをサーバーに送信（クッキーに保存）

3. **ログイン処理**：
   - ユーザーがログインボタンをクリックすると、`useLiff`フックの`login()`メソッドが呼び出される
   - LIFF SDKの`login()`メソッドが実行され、LINEログイン画面が表示される
   - ユーザーがLINEアカウントでログインすると、アプリケーションにリダイレクトされる

4. **トークン検証**：
   - ログイン成功後、LINEアクセストークンをサーバーサイドで検証
   - `LineAuthService`の`verifyLineToken()`メソッドがトークンの有効性を確認
   - クライアントIDと有効期限を検証

5. **プロフィール取得**：
   - 検証成功後、LINEユーザープロフィールを取得
   - `LineAuthService`の`getLineProfile()`メソッドがユーザー情報を取得
   - 取得したプロフィール情報をアプリケーションで利用

6. **セッション管理**：
   - ユーザーIDをHTTP Onlyクッキーに保存
   - セキュリティ設定（Secure、SameSite）を適用
   - クッキーの有効期限を設定（1週間）

7. **ログアウト処理**：
   - ユーザーがログアウトボタンをクリックすると、`useLiff`フックの`logout()`メソッドが呼び出される
   - LIFF SDKの`logout()`メソッドが実行され、ログイン状態がクリアされる
   - ページがリロードされ、初期状態に戻る

## 3.6 LIFF開発のベストプラクティス

### 3.6.1 セキュリティ

- **トークン検証**: サーバーサイドでLINEトークンを必ず検証する
- **HTTPSの使用**: 本番環境では必ずHTTPSを使用する
- **クッキーのセキュリティ設定**: HTTP Only、Secure、SameSiteなどの設定を適用する
- **最小権限の原則**: 必要最小限のスコープのみを要求する

### 3.6.2 ユーザー体験

- **ローディング状態の管理**: 初期化やプロフィール取得中のローディング状態を適切に表示する
- **エラーハンドリング**: エラー発生時にユーザーフレンドリーなメッセージを表示する
- **オフライン対応**: オフライン時の動作を考慮する
- **レスポンシブデザイン**: 様々なデバイスサイズに対応するデザインを実装する

### 3.6.3 パフォーマンス

- **遅延読み込み**: LIFF SDKを必要なときに読み込む
- **キャッシング**: プロフィール情報などをキャッシュする
- **状態管理の最適化**: 不要な再レンダリングを避ける

## 3.7 LIFFアプリケーションの作成手順

### 3.7.1 LINEデベロッパーコンソールでの設定

1. [LINEデベロッパーコンソール](https://developers.line.biz/console/)にアクセスし、ログインします。
2. プロバイダーを選択または作成します。
3. 「新規チャネル作成」をクリックし、「LIFFアプリ」を選択します。
4. チャネルの基本情報を入力します：
   - チャネル名
   - チャネル説明
   - アプリタイプ
   - プライバシーポリシーURL（任意）
   - 利用規約URL（任意）
5. 「作成」ボタンをクリックします。

### 3.7.2 LIFFアプリの設定

1. 作成したLIFFアプリの詳細ページで、「LIFF」タブをクリックします。
2. 「追加」ボタンをクリックし、以下の情報を入力します：
   - LIFFアプリ名
   - サイズ（Full、Tall、Compact）
   - エンドポイントURL（アプリケーションのURL）
   - Scope（プロフィール、チャット、OpenID Connect）
   - ボットリンク機能（オプション）
3. 「追加」ボタンをクリックします。
4. LIFF IDが発行されるので、メモしておきます。

### 3.7.3 プロジェクトへの統合

1. プロジェクトの`.env.local`ファイルに、LIFF IDとチャネルIDを設定します：
   ```
   NEXT_PUBLIC_LIFF_ID=your_liff_id_here
   NEXT_PUBLIC_LIFF_CHANNEL_ID=your_channel_id_here
   ```
2. `LiffProvider`コンポーネントをアプリケーションのルートコンポーネントでラップします：
   ```tsx
   import LiffProvider from '@/components/LiffProvider';

   export default function RootLayout({ children }: { children: React.ReactNode }) {
     return (
       <html lang="ja">
         <body>
           <LiffProvider>
             {children}
           </LiffProvider>
         </body>
       </html>
     );
   }
   ```
3. `useLiff`フックを使用して、コンポーネントからLIFF機能にアクセスします：
   ```tsx
   import { useLiff } from '@/hooks/useLiff';

   export default function LoginButton() {
     const { isLoggedIn, login, logout } = useLiff();

     return (
       <button onClick={isLoggedIn ? logout : login}>
         {isLoggedIn ? 'ログアウト' : 'LINEでログイン'}
       </button>
     );
   }
   ```

## 3.8 まとめ

LIFF認証は、LINEユーザーに対してシームレスなログイン体験を提供する強力な方法です。LIFF-Templateプロジェクトでは、`LiffProvider`コンポーネント、`useLiff`フック、サーバーサイド認証を組み合わせて、安全で使いやすい認証システムを実装しています。

クライアントサイドとサーバーサイドの両方でトークンを検証し、ユーザープロフィールを安全に管理することで、セキュリティを確保しています。また、ローディング状態やエラー状態を適切に管理することで、ユーザー体験を向上させています。

LIFFアプリケーションを開発する際は、セキュリティ、ユーザー体験、パフォーマンスのベストプラクティスに従うことが重要です。また、LINEデベロッパーコンソールでの適切な設定と、プロジェクトへの正しい統合が必要です。
