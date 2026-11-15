import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';

describe('Modal', () => {
  it('is a labelled dialog with its content', () => {
    render(
      <Modal title="Add visit" onClose={vi.fn()}>
        <p>Form here</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Add visit' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent('Form here');
  });

  it('closes from its Close button, Escape, or a click outside', async () => {
    const onClose = vi.fn();
    render(
      <Modal title="Add visit" onClose={onClose}>
        <p>Form here</p>
      </Modal>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("doesn't close on a click inside", async () => {
    const onClose = vi.fn();
    render(
      <Modal title="Add visit" onClose={onClose}>
        <p>Form here</p>
      </Modal>,
    );
    await userEvent.click(screen.getByText('Form here'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('can leave out the Close button and use another role', () => {
    render(
      <Modal title="Sure?" onClose={vi.fn()} closeLabel={null} role="alertdialog" className="extra">
        <p>Body</p>
      </Modal>,
    );
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(screen.getByRole('alertdialog', { name: 'Sure?' })).toHaveClass('visit-form-modal', 'extra');
  });

  it('closes only the top dialog on Escape', async () => {
    const closeBottom = vi.fn();
    const closeTop = vi.fn();
    render(
      <>
        <Modal title="Bottom" onClose={closeBottom}>
          <p>1</p>
        </Modal>
        <Modal title="Top" onClose={closeTop}>
          <p>2</p>
        </Modal>
      </>,
    );
    await userEvent.keyboard('{Escape}');
    expect(closeTop).toHaveBeenCalledOnce();
    expect(closeBottom).not.toHaveBeenCalled();
  });
});

describe('ConfirmDialog', () => {
  const renderDialog = (variant?: 'primary' | 'danger') => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Delete visit?"
        message="It can't be undone."
        confirmLabel="Delete visit"
        variant={variant}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    return { onConfirm, onCancel };
  };

  it('asks its question', () => {
    renderDialog();
    expect(screen.getByRole('alertdialog', { name: 'Delete visit?' })).toHaveTextContent(
      "It can't be undone.",
    );
  });

  it('confirms', async () => {
    const { onConfirm, onCancel } = renderDialog('danger');
    const confirm = screen.getByRole('button', { name: 'Delete visit' });
    expect(confirm).toHaveClass('action-button--danger');
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels from Cancel or Escape', async () => {
    const { onConfirm, onCancel } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
