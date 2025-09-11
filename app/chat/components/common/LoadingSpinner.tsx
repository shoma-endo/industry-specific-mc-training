'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | undefined;
  variant?: 'default' | 'primary' | 'secondary' | 'ghost' | undefined;
  text?: string | undefined;
  className?: string | undefined;
  fullscreen?: boolean | undefined;
  overlay?: boolean | undefined;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

const variantClasses = {
  default: 'text-gray-500',
  primary: 'text-blue-500',
  secondary: 'text-purple-500',
  ghost: 'text-gray-300',
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'default',
  text,
  className,
  fullscreen = false,
  overlay = false,
}) => {
  const spinner = (
    <div className={cn(
      'flex flex-col items-center justify-center gap-2',
      className
    )}>
      <Loader2 
        className={cn(
          'animate-spin',
          sizeClasses[size],
          variantClasses[variant]
        )}
      />
      {text && (
        <p className={cn(
          'text-sm font-medium',
          variantClasses[variant]
        )}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className={cn(
        'fixed inset-0 flex items-center justify-center',
        overlay && 'bg-white/80 backdrop-blur-sm z-50'
      )}>
        {spinner}
      </div>
    );
  }

  if (overlay) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export const FullscreenLoadingSpinner: React.FC<{ text?: string }> = ({
  text = '読み込み中...'
}) => (
  <LoadingSpinner
    size="xl"
    variant="primary"
    text={text}
    fullscreen
    overlay
  />
);

export default LoadingSpinner;
