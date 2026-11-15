import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActionButton } from './ActionButton';

describe('ActionButton', () => {
  it('shows its label and reports clicks', async () => {
    const onClick = vi.fn();
    render(<ActionButton onClick={onClick}>Save</ActionButton>);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is a plain button by default, or a submit button when asked', () => {
    const { rerender } = render(<ActionButton>Go</ActionButton>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    rerender(<ActionButton type="submit">Go</ActionButton>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('styles by variant', () => {
    const { rerender } = render(<ActionButton>Go</ActionButton>);
    expect(screen.getByRole('button')).toHaveClass('action-button--primary');
    rerender(<ActionButton variant="danger">Delete</ActionButton>);
    expect(screen.getByRole('button')).toHaveClass('action-button--danger');
  });

  it("doesn't respond when disabled", async () => {
    const onClick = vi.fn();
    render(
      <ActionButton onClick={onClick} disabled>
        Save
      </ActionButton>,
    );
    expect(screen.getByRole('button')).toBeDisabled();
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
