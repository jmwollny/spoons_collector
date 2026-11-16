import { describe, expect, it } from 'vitest';
import { addHistoryIds } from './history-ids.js';

describe('addHistoryIds', () => {
  const pubs = [
    { id: 1, name: 'S. Fowler & Co.', jdwId: 1352 },
    { id: 2, name: 'The Lynd Cross', jdwId: 1766, historyId: 99 },
    { id: 3, name: 'No Page', jdwId: null },
  ];

  it("sets each pub's history id, keeping one it had if the site has none", () => {
    const { pubs: updated, missing } = addHistoryIds(pubs, new Map([[1352, 5001]]));
    expect(updated.map((pub) => pub.historyId)).toEqual([5001, 99, null]);
    expect(missing).toEqual(['No Page (3)']);
  });
});
