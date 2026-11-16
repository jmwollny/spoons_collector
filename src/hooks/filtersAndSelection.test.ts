import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePubFilters } from './usePubFilters';
import { useSelectedPub } from './useSelectedPub';
import { samplePubs } from '../test/fixtures';

const names = (pubs: { name: string }[]) => pubs.map((pub) => pub.name);

// Most tests start from every pub showing, as if the user had chosen it
const FILTER_KEY = 'spoons-collector-visit-filter';
beforeEach(() => {
  window.localStorage.setItem(FILTER_KEY, 'all');
});

describe('the starting visit filter', () => {
  it("opens on the pubs visited until the user chooses", () => {
    window.localStorage.removeItem(FILTER_KEY);
    const { result } = renderHook(() => usePubFilters(samplePubs, new Set([3])));
    expect(result.current.visitFilter).toBe('visited');
    expect(names(result.current.filteredLocations)).toEqual(['The Punch Bowl']);
  });

  it('remembers the filter the user chooses', () => {
    const first = renderHook(() => usePubFilters(samplePubs, new Set()));
    act(() => first.result.current.chooseVisitFilter('unvisited'));
    expect(first.result.current.visitFilter).toBe('unvisited');
    first.unmount();
    expect(renderHook(() => usePubFilters(samplePubs, new Set())).result.current.visitFilter).toBe('unvisited');
  });

  it("doesn't remember filters the app sets itself, or clearing them", () => {
    window.localStorage.setItem(FILTER_KEY, 'visited');
    const first = renderHook(() => usePubFilters(samplePubs, new Set()));
    act(() => first.result.current.setVisitFilter('unvisited'));
    act(() => first.result.current.clearFilters());
    expect(first.result.current.visitFilter).toBe('all');
    first.unmount();
    expect(renderHook(() => usePubFilters(samplePubs, new Set())).result.current.visitFilter).toBe('visited');
  });

  it('ignores a saved filter it does not know', () => {
    window.localStorage.setItem(FILTER_KEY, 'sometimes');
    expect(renderHook(() => usePubFilters(samplePubs, new Set())).result.current.visitFilter).toBe('visited');
  });
});

describe('usePubFilters', () => {
  it('shows every pub to start with, sorted by name', () => {
    const { result } = renderHook(() => usePubFilters(samplePubs, new Set()));
    expect(result.current.filteredLocations).toHaveLength(4);
    expect(result.current.sortBy).toBe('name-asc');
  });

  it('searches names, towns and regions, ignoring case and spaces', () => {
    const { result } = renderHook(() => usePubFilters(samplePubs, new Set()));
    act(() => result.current.setSearchTerm('  LEEDS '));
    expect(names(result.current.filteredLocations)).toEqual(['The Cuthbert Brodrick', 'The Hedley Verity']);
    act(() => result.current.setSearchTerm('scotland'));
    expect(names(result.current.filteredLocations)).toEqual(['The Counting House']);
  });

  it('filters by region and by visited or not', () => {
    const { result } = renderHook(() => usePubFilters(samplePubs, new Set([1, 4])));
    act(() => result.current.setSelectedRegion('Yorkshire and The Humber'));
    expect(result.current.filteredLocations).toHaveLength(3);
    act(() => result.current.setVisitFilter('visited'));
    expect(names(result.current.filteredLocations)).toEqual(['The Cuthbert Brodrick']);
    act(() => result.current.setVisitFilter('unvisited'));
    expect(names(result.current.filteredLocations)).toEqual(['The Hedley Verity', 'The Punch Bowl']);
  });

  it('clears the search and filters, but not the sort order', () => {
    const { result } = renderHook(() => usePubFilters(samplePubs, new Set()));
    act(() => {
      result.current.setSearchTerm('york');
      result.current.setSelectedRegion('Scotland');
      result.current.setVisitFilter('visited');
      result.current.setSortBy('rarity-desc');
    });
    act(() => result.current.clearFilters());
    expect(result.current.searchTerm).toBe('');
    expect(result.current.selectedRegion).toBe('all');
    expect(result.current.visitFilter).toBe('all');
    expect(result.current.sortBy).toBe('rarity-desc');
    expect(result.current.filteredLocations).toHaveLength(4);
  });
});

const renderSelection = () =>
  renderHook(() => {
    const filters = usePubFilters(samplePubs, new Set());
    return { filters, selection: useSelectedPub(samplePubs, filters) };
  });

describe('useSelectedPub', () => {
  it('starts on the first pub', () => {
    const { result } = renderSelection();
    expect(result.current.selection.selectedId).toBe(1);
    expect(result.current.selection.selectedPub.name).toBe('The Cuthbert Brodrick');
  });

  it('selects a pub', () => {
    const { result } = renderSelection();
    act(() => result.current.selection.select(3));
    expect(result.current.selection.selectedPub.name).toBe('The Punch Bowl');
  });

  it('moves to a pub the filters show when they hide the selected one', () => {
    const { result } = renderSelection();
    act(() => result.current.filters.setSearchTerm('glasgow'));
    expect(result.current.selection.selectedId).toBe(4);
  });

  it('selects any pub, clearing filters that hide it', () => {
    const { result } = renderSelection();
    act(() => result.current.filters.setSearchTerm('leeds'));
    act(() => result.current.selection.selectAnyPub(3));
    expect(result.current.filters.searchTerm).toBe('');
    expect(result.current.selection.selectedId).toBe(3);
  });

  it("keeps the filters when they already show the pub", () => {
    const { result } = renderSelection();
    act(() => result.current.filters.setSearchTerm('leeds'));
    act(() => result.current.selection.selectAnyPub(2));
    expect(result.current.filters.searchTerm).toBe('leeds');
    expect(result.current.selection.selectedId).toBe(2);
  });
});
