'use server';

import { z } from 'zod';

export const userSearchCountSchema = z.object({
  liffAccessToken: z.string(),
});

export const getUserSearchCountAction = async (): Promise<{ error?: string }> => {
  try {
    // Google Search機能は廃止されました
    return { error: 'Google Search feature has been deprecated' };
  } catch (error) {
    console.error('Error in getUserSearchCountAction:', error);
    return { error: 'Internal server error' };
  }
};
