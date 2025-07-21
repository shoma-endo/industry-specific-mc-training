'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

// 開発環境判定
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // シンプルなエラーログ出力
    console.error('ErrorBoundary caught an error:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorBoundary: this.constructor.name,
    });

    // 親コンポーネントへの通知
    this.props.onError?.(error, errorInfo);

    // 開発環境でのみ詳細なログ出力
    if (IS_DEVELOPMENT) {
      console.group('🚨 Error Boundary Details');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;

    // プロパティ変更時の自動リセット
    if (hasError && resetOnPropsChange && resetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => prevProps.resetKeys?.[index] !== key
      );

      if (hasResetKeyChanged) {
        this.resetError();
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      window.clearTimeout(this.resetTimeoutId);
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  handleRetry = () => {
    this.resetError();
  };

  handleReload = () => {
    window.location.reload();
  };

  // シンプルなエラーメッセージ生成
  private getErrorMessage(error: Error | null): string {
    if (!error) return '予期せぬエラーが発生しました';

    // エラータイプに応じたメッセージ
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      return 'アプリケーションの読み込みに失敗しました。ページを再読み込みしてください。';
    }

    if (error.message.includes('Network')) {
      return 'ネットワークエラーが発生しました。接続を確認してください。';
    }

    return error.message || '予期せぬエラーが発生しました';
  }

  // エラーの重要度判定
  private getErrorSeverity(error: Error | null): 'low' | 'medium' | 'high' | 'critical' {
    if (!error) return 'medium';

    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      return 'critical';
    }

    if (error.message.includes('Network')) {
      return 'high';
    }

    return 'medium';
  }

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      const { error, errorId } = this.state;

      // カスタムフォールバックが提供されている場合
      if (fallback) {
        return fallback;
      }

      // デフォルトのエラー表示
      const errorMessage = this.getErrorMessage(error);
      const severity = this.getErrorSeverity(error);

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <CardTitle className="text-xl font-semibold text-red-700">
                エラーが発生しました
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>

              <div className="flex gap-2 justify-center">
                <Button onClick={this.handleRetry} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  再試行
                </Button>

                {severity === 'critical' && (
                  <Button onClick={this.handleReload} variant="destructive">
                    ページを再読み込み
                  </Button>
                )}
              </div>

              {IS_DEVELOPMENT && error && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                    開発者情報（デバッグ用）
                  </summary>
                  <div className="mt-2 p-3 bg-gray-50 rounded text-xs">
                    <p>
                      <strong>Error ID:</strong> {errorId}
                    </p>
                    <p>
                      <strong>Error Name:</strong> {error.name}
                    </p>
                    <p>
                      <strong>Error Message:</strong> {error.message}
                    </p>
                    {error.stack && (
                      <details className="mt-2">
                        <summary className="cursor-pointer">Stack Trace</summary>
                        <pre className="mt-1 text-xs overflow-auto">{error.stack}</pre>
                      </details>
                    )}
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// 関数型コンポーネント用のラッパー
interface WithErrorBoundaryProps {
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: WithErrorBoundaryProps
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

export default ErrorBoundary;
