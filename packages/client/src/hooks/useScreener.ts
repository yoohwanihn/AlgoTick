import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listRules,
  runScreener,
  saveRule,
  deleteRule,
  type ScreenerCondition,
} from '../api/screener.js';

export function useScreenerRules() {
  return useQuery({ queryKey: ['screener', 'rules'], queryFn: listRules });
}

export function useRunScreener() {
  return useMutation({
    mutationFn: (conditions: ScreenerCondition[]) => runScreener(conditions),
  });
}

export function useSaveRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, conditions }: { name: string; conditions: ScreenerCondition[] }) =>
      saveRule(name, conditions),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['screener', 'rules'] });
    },
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['screener', 'rules'] });
    },
  });
}
