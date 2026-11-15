import type { ReactNode } from 'react';

/** One line of a card's stats: a label and its value */
export const StatRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="stat-row">
    <span className="stat-label">{label}</span>
    {typeof children === 'string' || typeof children === 'number' ? (
      <span className="stat-value">{children}</span>
    ) : (
      children
    )}
  </div>
);
