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

    const drawBadge = (img?: HTMLImageElement) => {
      const favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (!favicon) return;

      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (img) {
        ctx.drawImage(img, 0, 0, 32, 32);
      } else {
        // フォールバック: 単色の丸をベースに描画（CORSで元画像が読めない場合）
        ctx.fillStyle = '#1f2937'; // gray-800
        ctx.beginPath();
        ctx.arc(16, 16, 16, 0, 2 * Math.PI);
        ctx.fill();
      }

      // バッジ描画
      const badgeSize = 14;
      const x = 32 - badgeSize;
      const y = 32 - badgeSize;

      ctx.beginPath();
      ctx.arc(x + badgeSize / 2, y + badgeSize / 2, badgeSize / 2, 0, 2 * Math.PI);
      ctx.fillStyle = '#ef4444'; // red-500
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const text = count > 99 ? '99+' : count.toString();
      ctx.fillText(text, x + badgeSize / 2, y + badgeSize / 2 + 1);

      favicon.href = canvas.toDataURL('image/png');
    };

    const favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (!favicon) return;

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = originalHref.current || favicon.href;

    img.onload = () => drawBadge(img);
    img.onerror = () => drawBadge(); // フォールバック描画

    // 画像が即座にcache hitしない場合もあるのでtimeoutフォールバック
    setTimeout(() => {
      // onload/onerrorのどちらもまだ呼ばれていなければフォールバック
      if (!img.complete) {
        drawBadge();
      }
    }, 3000);

    // クリーンアップは特に不要（アンマウント時に元に戻すかは要件次第だが、戻したほうが安全）
    return () => {
      if (link && originalHref.current) {
        link.href = originalHref.current;
      }
    };
  }, [count]);
};
