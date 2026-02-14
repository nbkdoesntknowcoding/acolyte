'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import { LoadingState } from './loading-state';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import type { PaginatedResponse } from '@/types/admin-api';

interface DataTableWrapperWithQueryProps<T> {
  query: UseQueryResult<PaginatedResponse<T>>;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  loadingRows?: number;
  children: (data: T[], meta: { total: number; page: number; page_size: number; total_pages: number }) => React.ReactNode;
}

interface DataTableWrapperSimpleProps {
  query?: undefined;
  children: React.ReactNode;
}

type DataTableWrapperProps<T = unknown> = DataTableWrapperWithQueryProps<T> | DataTableWrapperSimpleProps;

export function DataTableWrapper<T>({
  children,
  ...rest
}: DataTableWrapperProps<T>) {
  // Simple wrapper mode — no query prop, just render children
  if (!('query' in rest) || rest.query === undefined) {
    return <>{children}</>;
  }

  const {
    query,
    emptyTitle = 'No records found',
    emptyDescription,
    emptyActionLabel,
    onEmptyAction,
    loadingRows = 5,
  } = rest as DataTableWrapperWithQueryProps<T>;

  if (query.isLoading) {
    return <LoadingState rows={loadingRows} />;
  }

  if (query.isError) {
    return (
      <ErrorState
        message={query.error?.message}
        onRetry={() => query.refetch()}
      />
    );
  }

  const result = query.data;
  if (!result || result.data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }

  return (
    <>
      {(children as (data: T[], meta: { total: number; page: number; page_size: number; total_pages: number }) => React.ReactNode)(result.data, {
        total: result.total,
        page: result.page,
        page_size: result.page_size,
        total_pages: result.total_pages,
      })}
    </>
  );
}
