import { useEffect, useRef } from 'react';

export const useFaviconBadge = (count: number) => {
  const originalHref = useRef<string | null>(null);

  useEffect(() => {
    // 初期faviconの保存
    const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (link && !originalHref.current) {
      originalHref.current = link.href;
    }

    if (count === 0) {
      // カウント0なら元に戻す
      if (link && originalHref.current) {
        link.href = originalHref.current;
      }
      return;
    }

    const drawBadge = () => {
      const favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (!favicon) return;

      const img = new Image();
      // 元のアイコン読み込み（CORS対応が必要な場合はcrossOrigin設定）
      img.crossOrigin = 'Anonymous';
      
      // 元の画像がない場合や読み込めない場合のフォールバックも考慮すべきだが
      // ここでは元のfaviconパスを使用
      img.src = originalHref.current || favicon.href;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 元画像を書き込み
        ctx.drawImage(img, 0, 0, 32, 32);

        // バッジを描画
        // 右下に赤丸
        const badgeSize = 14;
        const x = 32 - badgeSize;
        const y = 32 - badgeSize;
        
        ctx.beginPath();
        ctx.arc(x + badgeSize/2, y + badgeSize/2, badgeSize/2, 0, 2 * Math.PI);
        ctx.fillStyle = '#ef4444'; // red-500
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 数字を描画
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 99以上は '99+'
        const text = count > 99 ? '99+' : count.toString();
        ctx.fillText(text, x + badgeSize/2, y + badgeSize/2 + 1); // 微調整

        // ファビコン更新
        favicon.href = canvas.toDataURL('image/png');
      };
    };

    drawBadge();

    // クリーンアップは特に不要（アンマウント時に元に戻すかは要件次第だが、戻したほうが安全）
    return () => {
      if (link && originalHref.current) {
        link.href = originalHref.current;
      }
    };
  }, [count]);
};

