import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './api';
import type { Me } from './types';

export function useMe() {
  return useQuery<Me | null>({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api.get<Me>('/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 60_000,
  });
}

export function useConfig() {
  return useQuery<any>({ queryKey: ['config'], queryFn: () => api.get('/config'), staleTime: 5 * 60_000 });
}

export function useLogout() {
  const qc = useQueryClient();
  return async () => {
    await api.post('/auth/logout');
    qc.clear();
    window.location.href = '/';
  };
}
