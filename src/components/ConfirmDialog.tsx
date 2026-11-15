import type { ReactNode } from 'react';
import { ActionButton } from './ActionButton';
import { Modal } from './Modal';

type ConfirmDialogProps = {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  // 'danger' for actions that delete something
  variant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Asks the user to confirm an action. Escape, Back, Cancel or a tap outside
 * the dialog cancels.
 */
export const ConfirmDialog = ({
  title,
  message,
  confirmLabel,
  variant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => (
  <Modal
    title={title}
    onClose={onCancel}
    className="confirm-dialog"
    role="alertdialog"
    closeLabel={null}
  >
    <p className="confirm-dialog-message">{message}</p>
    <div className="confirm-dialog-actions">
      <button type="button" className="visit-form-close" onClick={onCancel}>
        Cancel
      </button>
      <ActionButton variant={variant} onClick={onConfirm}>
        {confirmLabel}
      </ActionButton>
    </div>
  </Modal>
);
