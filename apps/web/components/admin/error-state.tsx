'use client';

import { Button } from '@/components/ui/button';

export interface ErrorStateProps {
  message?: string;
  error?: Error | null;
  onRetry?: () => void;
}

export function ErrorState({
  message,
  error,
  onRetry,
}: ErrorStateProps) {
  const displayMessage = message || error?.message || 'Something went wrong. Please try again.';
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 text-4xl">!</div>
      <h3 className="text-lg font-semibold text-destructive">Error</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{displayMessage}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="mt-4" size="sm">
          Try again
        </Button>
      )}
    </div>
  );
}
