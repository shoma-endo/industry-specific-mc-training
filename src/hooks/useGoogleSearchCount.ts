'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLiff } from '@/hooks/useLiff';

export function useGoogleSearchCount() {
  const { getAccessToken } = useLiff();
  const [googleSearchCount, setGoogleSearchCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSearchCount = useCallback(async () => {
    try {
      setLoading(true);
      const liffAccessToken = await getAccessToken();
      
      const response = await fetch('/api/user/search-count', {
        headers: {
          'Authorization': `Bearer ${liffAccessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch search count');
      }

      const data = await response.json();
      setGoogleSearchCount(data.googleSearchCount);
      setError(null);
    } catch (err) {
      console.error('Error fetching search count:', err);
      setError('利用回数の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchSearchCount();
  }, [fetchSearchCount]);

  return {
    googleSearchCount,
    loading,
    error,
    refetch: fetchSearchCount,
  };
}