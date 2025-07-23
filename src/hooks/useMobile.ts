'use client';

import { useState, useEffect } from 'react';

interface UseMobileResult {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  orientation: 'portrait' | 'landscape';
}

const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
} as const;

export const useMobile = (): UseMobileResult => {
  const [screenState, setScreenState] = useState<{
    width: number;
    orientation: 'portrait' | 'landscape';
  }>({
    width: 0,
    orientation: 'portrait',
  });

  useEffect(() => {
    const updateScreenState = () => {
      const width = window.innerWidth;
      const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
      
      setScreenState({ width, orientation });
    };

    // 初期設定
    updateScreenState();

    // リサイズ・向き変更イベントのリスナー
    window.addEventListener('resize', updateScreenState);
    window.addEventListener('orientationchange', updateScreenState);

    return () => {
      window.removeEventListener('resize', updateScreenState);
      window.removeEventListener('orientationchange', updateScreenState);
    };
  }, []);

  const isMobile = screenState.width < BREAKPOINTS.mobile;
  const isTablet = screenState.width >= BREAKPOINTS.mobile && screenState.width < BREAKPOINTS.tablet;
  const isDesktop = screenState.width >= BREAKPOINTS.tablet;

  return {
    isMobile,
    isTablet,
    isDesktop,
    screenWidth: screenState.width,
    orientation: screenState.orientation,
  };
};