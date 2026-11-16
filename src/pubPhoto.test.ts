import { describe, expect, it } from 'vitest';
import { pubPhotoUrl } from './pubPhoto';

const pub = { id: 7, imgType: 'jpg', imgUrl: 'https://www.jdwetherspoon.com/7.jpg' };

describe('pubPhotoUrl', () => {
  it('uses our own copy by default', () => {
    expect(pubPhotoUrl(pub)).toBe('/images/7.webp');
  });

  it("uses Wetherspoon's site in a shareable build", () => {
    expect(pubPhotoUrl(pub, true)).toBe('https://www.jdwetherspoon.com/7.jpg');
  });

  it('has nothing for a pub without a photo', () => {
    expect(pubPhotoUrl({ ...pub, imgType: null }, false)).toBeNull();
    expect(pubPhotoUrl({ ...pub, imgType: null }, true)).toBeNull();
  });
});
