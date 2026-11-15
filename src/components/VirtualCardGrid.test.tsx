import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VirtualCardGrid } from './VirtualCardGrid';
import { setMediaQueryMatches, stubLayout } from '../test/browser';

const items = Array.from({ length: 100 }, (_, index) => ({ id: index, name: `Pub ${index}` }));

const renderGrid = (scrollResetKey = 'a') =>
  render(
    <VirtualCardGrid
      className="grid"
      items={items}
      getKey={(item) => item.id}
      renderItem={(item) => <div data-testid="card">{item.name}</div>}
      minColumnWidth={224}
      gap={16}
      estimatedRowHeight={400}
      pageScrollQuery="(max-width: 600px)"
      scrollResetKey={scrollResetKey}
    />,
  );

let restore: () => void = () => {};
afterEach(() => restore());

describe('VirtualCardGrid in its own scroll box', () => {
  it('lays cards out in as many columns as fit', () => {
    // (500 + 16) / (224 + 16) → 2 columns
    restore = stubLayout({ width: 500, height: 800, rowHeight: 400 });
    setMediaQueryMatches(() => false);
    const { container } = renderGrid();
    const row = container.querySelector<HTMLElement>('.virtual-grid-row')!;
    expect(row.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
    expect(row.querySelectorAll('[data-testid="card"]')).toHaveLength(2);
  });

  it('draws only the rows on screen, not all 100 cards', () => {
    restore = stubLayout({ width: 500, height: 800, rowHeight: 400 });
    setMediaQueryMatches(() => false);
    renderGrid();
    const drawn = screen.getAllByTestId('card');
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.length).toBeLessThan(20);
    expect(drawn[0]).toHaveTextContent('Pub 0');
  });

  it('makes the list as tall as all the rows, so it scrolls', () => {
    restore = stubLayout({ width: 500, height: 800, rowHeight: 400 });
    setMediaQueryMatches(() => false);
    const { container } = renderGrid();
    // 50 rows of 2, each measured at 400px
    expect(container.querySelector<HTMLElement>('.virtual-grid')!.style.height).toBe('20000px');
  });

  it('goes back to the top when the reset key changes', () => {
    restore = stubLayout({ width: 500, height: 800, rowHeight: 400 });
    setMediaQueryMatches(() => false);
    const { container, rerender } = renderGrid('a');
    const box = container.querySelector<HTMLElement>('.grid')!;
    (box.scrollTo as unknown as { mockClear: () => void }).mockClear();
    rerender(
      <VirtualCardGrid
        className="grid"
        items={items}
        getKey={(item) => item.id}
        renderItem={(item) => <div data-testid="card">{item.name}</div>}
        minColumnWidth={224}
        gap={16}
        estimatedRowHeight={400}
        pageScrollQuery="(max-width: 600px)"
        scrollResetKey="b"
      />,
    );
    expect(box.scrollTo).toHaveBeenCalledWith({ top: 0 });
  });
});

describe('VirtualCardGrid scrolling with the page', () => {
  it('shows one card per row, only those near the screen', () => {
    restore = stubLayout({ width: 360, height: 800, rowHeight: 400 });
    setMediaQueryMatches((query) => query === '(max-width: 600px)');
    const { container } = renderGrid();
    const rows = container.querySelectorAll<HTMLElement>('.virtual-grid-row');
    expect(rows[0].style.gridTemplateColumns).toBe('repeat(1, minmax(0, 1fr))');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(10);
  });
});
