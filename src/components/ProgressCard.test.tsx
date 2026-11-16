import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressCard } from './ProgressCard';

describe('ProgressCard', () => {
  it('shows a title and a line about it above its contents, which scroll on their own', () => {
    const { container } = render(
      <ProgressCard title="Regions" subtitle="Every corner of the map." className="extra">
        <ul>
          <li>Wales</li>
        </ul>
      </ProgressCard>,
    );
    expect(screen.getByRole('heading', { name: 'Regions' })).toBeInTheDocument();
    expect(screen.getByText('Every corner of the map.')).toBeInTheDocument();
    const card = container.firstElementChild!;
    expect(card).toHaveClass('card', 'progress-card', 'extra');
    // The contents sit in their own box, below the title
    const body = card.querySelector('.progress-card-body')!;
    expect(body).toHaveTextContent('Wales');
    expect(body).not.toContainElement(screen.getByRole('heading'));
  });
});
