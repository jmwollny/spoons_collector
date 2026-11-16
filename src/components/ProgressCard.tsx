import type { ReactNode } from 'react';

type ProgressCardProps = {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * One of the cards under the map: a title and a line about it, then its
 * contents. On wide screens the cards share one height (see
 * ProgressSection) and only the contents scroll, so the title stays put and
 * the scrollbar stays inside the card's rounded corners.
 */
export const ProgressCard = ({ title, subtitle, children, className = '' }: ProgressCardProps) => (
  <div className={`card progress-card ${className}`}>
    <div className="section-heading">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
    <div className="progress-card-body">{children}</div>
  </div>
);
