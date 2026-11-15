import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StarRating from './StarRating';
import StarIcon from './StarIcon';

const stars = () => screen.getAllByRole('button', { name: /Rate \d out of 3/ });

describe('StarRating', () => {
  it('shows a star per point, lighting those up to the rating', () => {
    render(<StarRating maxRating={3} rating={1} onClicked={vi.fn()} />);
    expect(stars().map((star) => star.getAttribute('aria-pressed'))).toEqual(['true', 'true', 'false']);
  });

  it('rates up to the star clicked', async () => {
    const onClicked = vi.fn();
    render(<StarRating maxRating={3} rating={-1} onClicked={onClicked} />);
    await userEvent.click(stars()[2]);
    expect(onClicked).toHaveBeenCalledWith(2);
  });

  it('clears the rating when the only lit star is clicked again', async () => {
    const onClicked = vi.fn();
    render(<StarRating maxRating={3} rating={0} onClicked={onClicked} />);
    await userEvent.click(stars()[0]);
    expect(onClicked).toHaveBeenCalledWith(-1);
  });

  it('can be used from the keyboard', async () => {
    const onClicked = vi.fn();
    render(<StarRating maxRating={3} rating={-1} onClicked={onClicked} />);
    await userEvent.tab();
    expect(stars()[0]).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onClicked).toHaveBeenLastCalledWith(0);
    await userEvent.tab();
    await userEvent.keyboard(' ');
    expect(onClicked).toHaveBeenLastCalledWith(1);
  });

  it('follows the rating it is given', () => {
    const { rerender } = render(<StarRating maxRating={3} rating={0} onClicked={vi.fn()} />);
    rerender(<StarRating maxRating={3} rating={2} onClicked={vi.fn()} />);
    expect(stars().every((star) => star.getAttribute('aria-pressed') === 'true')).toBe(true);
  });

  it('as a display, reads as one image and ignores clicks', async () => {
    const onClicked = vi.fn();
    render(<StarRating maxRating={3} rating={1} disabled onClicked={onClicked} />);
    expect(screen.getByRole('img', { name: 'Rated 2 out of 3' })).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    await userEvent.click(screen.getByRole('img').querySelector('svg')!);
    expect(onClicked).not.toHaveBeenCalled();
  });

  it('says "Not rated" for no rating', () => {
    render(<StarRating maxRating={3} rating={-1} disabled />);
    expect(screen.getByRole('img', { name: 'Not rated' })).toBeInTheDocument();
  });
});

describe('StarIcon', () => {
  it('is 40px unless given a size', () => {
    const { container, rerender } = render(<StarIcon id={0} rated={false} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '40px');
    rerender(<StarIcon id={0} rated={false} size={16} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '16px');
  });

  it('marks itself rated or not for styling', () => {
    const { container, rerender } = render(<StarIcon id={0} rated={true} />);
    expect(container.querySelector('path')).toHaveClass('star', 'rated');
    rerender(<StarIcon id={0} rated={false} disabled />);
    expect(container.querySelector('path')).toHaveClass('unrated', 'aria-disabled');
  });

  it('ignores other keys', async () => {
    const onClicked = vi.fn();
    render(<StarIcon id={1} rated={false} onClicked={onClicked} label="Rate 2" />);
    screen.getByRole('button', { name: 'Rate 2' }).focus();
    await userEvent.keyboard('a');
    expect(onClicked).not.toHaveBeenCalled();
  });
});
