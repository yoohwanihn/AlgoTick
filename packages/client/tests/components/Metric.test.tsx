import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Metric } from '../../src/components/ui/Metric.js';

describe('Metric', () => {
  it('renders label and value', () => {
    render(<Metric label="PER" value="28.4" />);
    expect(screen.getByText('PER')).toBeInTheDocument();
    expect(screen.getByText('28.4')).toBeInTheDocument();
  });

  it('shows actual confidence (●)', () => {
    render(<Metric label="ROE" value="15%" confidence="actual" />);
    expect(screen.getByLabelText(/신뢰도/)).toHaveTextContent('●');
  });

  it('estimated confidence shows ◐', () => {
    render(<Metric label="EBITDA" value="100" confidence="estimated" />);
    expect(screen.getByLabelText(/신뢰도/)).toHaveTextContent('◐');
  });

  it('assumed confidence shows ○', () => {
    render(<Metric label="WACC" value="0.08" confidence="assumed" />);
    expect(screen.getByLabelText(/신뢰도/)).toHaveTextContent('○');
  });

  it('omits icon when confidence missing', () => {
    render(<Metric label="X" value="Y" />);
    expect(screen.queryByLabelText(/신뢰도/)).not.toBeInTheDocument();
  });
});
