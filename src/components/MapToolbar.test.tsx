import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapToolbar } from './MapToolbar';
import { SelectedPubSummary } from './SelectedPubSummary';
import { VisitMetrics } from './VisitMetrics';
import { leeds1, makeVisit } from '../test/fixtures';

const renderToolbar = (overrides: Partial<React.ComponentProps<typeof MapToolbar>> = {}) => {
  const props = {
    onAddVisit: vi.fn(),
    visitCount: 2,
    onShowVisits: vi.fn(),
    onPlanCrawl: vi.fn(),
    canPlanCrawl: true,
    isLiveLocationOn: false,
    onToggleLiveLocation: vi.fn(),
    ...overrides,
  };
  render(<MapToolbar {...props}>summary here</MapToolbar>);
  return props;
};

describe('MapToolbar', () => {
  it('offers each action', async () => {
    const props = renderToolbar();
    await userEvent.click(screen.getByRole('button', { name: 'Add visit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Visits (2)' }));
    await userEvent.click(screen.getByRole('button', { name: /Plan a crawl/ }));
    await userEvent.click(screen.getByRole('button', { name: /Live location: Off/ }));
    expect(props.onAddVisit).toHaveBeenCalledOnce();
    expect(props.onShowVisits).toHaveBeenCalledOnce();
    expect(props.onPlanCrawl).toHaveBeenCalledOnce();
    expect(props.onToggleLiveLocation).toHaveBeenCalledOnce();
    expect(screen.getByText('summary here')).toBeInTheDocument();
  });

  it("can't show visits for a pub without any", () => {
    renderToolbar({ visitCount: 0 });
    expect(screen.getByRole('button', { name: 'Visits (0)' })).toBeDisabled();
  });

  it("can't plan a second crawl, and says why", () => {
    renderToolbar({ canPlanCrawl: false });
    const plan = screen.getByRole('button', { name: /Plan a crawl/ });
    expect(plan).toBeDisabled();
    expect(plan).toHaveAttribute('title', 'Finish or end this crawl to plan another');
  });

  it('shows whether live location is on', () => {
    renderToolbar({ isLiveLocationOn: true });
    const live = screen.getByRole('button', { name: /Live location: On/ });
    expect(live).toHaveAttribute('aria-pressed', 'true');
    expect(live).toHaveClass('is-on');
  });
});

describe('SelectedPubSummary', () => {
  it('says when a pub has not been visited', () => {
    render(<SelectedPubSummary pub={leeds1} visits={[]} />);
    expect(screen.getByText('The Cuthbert Brodrick')).toBeInTheDocument();
    expect(screen.getByText('Not visited yet')).toBeInTheDocument();
  });

  it('shows the latest visit and rating', () => {
    render(<SelectedPubSummary pub={leeds1} visits={[makeVisit(1, '2026-11-14', { rating: 1 })]} />);
    expect(screen.getByText('14 Nov 2026')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Rated 2 out of 3' })).toBeInTheDocument();
    expect(screen.queryByText(/visits$/)).not.toBeInTheDocument();
  });

  it('counts several visits', () => {
    render(
      <SelectedPubSummary
        pub={leeds1}
        visits={[makeVisit(1, '2026-11-14'), makeVisit(1, '2026-11-01', { id: 'b' })]}
      />,
    );
    expect(screen.getByText('2 visits')).toBeInTheDocument();
  });
});

describe('VisitMetrics', () => {
  it('shows pubs visited and the share of them all', () => {
    render(<VisitMetrics visitedCount={201} totalCount={804} />);
    expect(screen.getByText('201')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('copes with no pubs', () => {
    render(<VisitMetrics visitedCount={0} totalCount={0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
