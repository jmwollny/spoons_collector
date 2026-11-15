import { Fragment, useEffect, useRef, type ReactNode } from 'react';
import { useVirtualizer, useWindowVirtualizer, type Virtualizer } from '@tanstack/react-virtual';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useContentWidth, usePageOffset } from '../hooks/useElementMeasurements';
import './VirtualCardGrid.css';

type VirtualCardGridProps<T> = {
  items: T[];
  getKey: (item: T) => string | number;
  renderItem: (item: T) => ReactNode;
  // Cards are at least this wide; as many columns as fit
  minColumnWidth: number;
  // Space between columns, in pixels (matching the CSS)
  gap: number;
  // A first guess at a row's height, before it's measured
  estimatedRowHeight: number;
  // Where the grid scrolls with the page, in one column, rather than in a
  // box of its own (phones)
  pageScrollQuery: string;
  className?: string;
  // When this changes (e.g. a new search), the grid scrolls back to its
  // first card. Only when it scrolls in its own box: on phones it's part
  // of the page, which shouldn't jump.
  scrollResetKey?: string;
};

/**
 * A grid of cards that only draws the rows on screen (and a couple either
 * side), so a list of hundreds of cards stays quick, especially on phones.
 * Rows are measured as they're drawn, so cards can be any height.
 */
export function VirtualCardGrid<T>(props: VirtualCardGridProps<T>) {
  const scrollsWithPage = useMediaQuery(props.pageScrollQuery);
  // Separate components, as the two kinds of scrolling need different hooks
  return scrollsWithPage ? <PageScrollGrid {...props} /> : <BoxScrollGrid {...props} />;
}

const toRows = <T,>(items: T[], columns: number) => {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }
  return rows;
};

/** The grid scrolls inside its own box (wide screens) */
function BoxScrollGrid<T>({
  items,
  getKey,
  renderItem,
  minColumnWidth,
  gap,
  estimatedRowHeight,
  className = '',
  scrollResetKey,
}: VirtualCardGridProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [scrollResetKey]);
  const width = useContentWidth(scrollRef);
  // As many columns as fit, like CSS's repeat(auto-fill, minmax(...))
  const columns = Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap)));
  const rows = toRows(items, columns);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 2,
  });

  return (
    <div ref={scrollRef} className={className}>
      <Rows virtualizer={virtualizer} rows={rows} columns={columns} offset={0} getKey={getKey} renderItem={renderItem} />
    </div>
  );
}

/** The grid scrolls with the page, one card per row (phones) */
function PageScrollGrid<T>({
  items,
  getKey,
  renderItem,
  estimatedRowHeight,
  className = '',
}: VirtualCardGridProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  // How far down the page the grid starts
  const pageOffset = usePageOffset(listRef);

  const rows = toRows(items, 1);
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => estimatedRowHeight,
    overscan: 2,
    scrollMargin: pageOffset,
  });

  return (
    <div ref={listRef} className={className}>
      <Rows
        virtualizer={virtualizer}
        rows={rows}
        columns={1}
        offset={pageOffset}
        getKey={getKey}
        renderItem={renderItem}
      />
    </div>
  );
}

type RowsProps<T> = {
  virtualizer: Virtualizer<HTMLDivElement, Element> | Virtualizer<Window, Element>;
  rows: T[][];
  columns: number;
  // The grid's distance from the top of what scrolls
  offset: number;
  getKey: (item: T) => string | number;
  renderItem: (item: T) => ReactNode;
};

/** The rows on screen, each placed where it would be in the full list */
function Rows<T>({ virtualizer, rows, columns, offset, getKey, renderItem }: RowsProps<T>) {
  return (
    <div className="virtual-grid" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((virtualRow) => (
        <div
          key={virtualRow.key}
          data-index={virtualRow.index}
          ref={virtualizer.measureElement}
          className="virtual-grid-row"
          style={{
            transform: `translateY(${virtualRow.start - offset}px)`,
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          }}
        >
          {rows[virtualRow.index]?.map((item) => (
            <Fragment key={getKey(item)}>{renderItem(item)}</Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}
