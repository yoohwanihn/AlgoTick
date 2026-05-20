import { useMutation } from '@tanstack/react-query';
import { calculateValuation, type ValuationInputs } from '../api/valuation.js';

export function useValuation(symbol: string) {
  return useMutation({
    mutationFn: (inputs: ValuationInputs) => calculateValuation(symbol, inputs),
  });
}
