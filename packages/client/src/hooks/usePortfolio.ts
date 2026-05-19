import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPortfolio, listLots, addLot, deleteLot, type AddLotBody } from '../api/portfolio.js';

export function usePortfolio() {
  return useQuery({ queryKey: ['portfolio'], queryFn: getPortfolio });
}
export function useLots() {
  return useQuery({ queryKey: ['portfolio', 'lots'], queryFn: listLots });
}
export function useAddLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AddLotBody) => addLot(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      qc.invalidateQueries({ queryKey: ['portfolio', 'lots'] });
    },
  });
}
export function useDeleteLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLot(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      qc.invalidateQueries({ queryKey: ['portfolio', 'lots'] });
    },
  });
}
