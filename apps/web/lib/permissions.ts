'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';

const PERMIFY_API_URL = process.env.NEXT_PUBLIC_PERMIFY_URL || 'http://localhost:3476';

/**
 * Check a permission against Permify.
 * Uses Zanzibar-style entity:relation:subject model.
 */
export function usePermify(
  permission: string,
  entityType: string,
  entityId: string,
): { allowed: boolean; loading: boolean } {
  const { userId } = useAuth();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !entityId) {
      setLoading(false);
      return;
    }

    // TODO: Replace with actual Permify check API call
    // For now, default to allowed during development
    setAllowed(true);
    setLoading(false);
  }, [userId, permission, entityType, entityId]);

  return { allowed, loading };
}

export function useCanViewCompliance(collegeId: string) {
  return usePermify('view_compliance', 'college', collegeId);
}

export function useCanSignLogbook(departmentId: string) {
  return usePermify('sign_logbook', 'department', departmentId);
}

export function useCanCreateAssessment(departmentId: string) {
  return usePermify('create_assessment', 'department', departmentId);
}

export function useCanApproveAssessment(departmentId: string) {
  return usePermify('approve_assessment', 'department', departmentId);
}

export function useCanManageCollege(collegeId: string) {
  return usePermify('manage', 'college', collegeId);
}
