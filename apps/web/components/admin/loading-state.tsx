'use client';

import { Skeleton } from '@/components/ui/skeleton';

interface LoadingStateProps {
  /** Number of skeleton rows to show (default 5) */
  rows?: number;
  /** Show card-style skeleton instead of table rows */
  variant?: 'table' | 'card';
}

export function LoadingState({ rows = 5, variant = 'table' }: LoadingStateProps) {
  if (variant === 'card') {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
