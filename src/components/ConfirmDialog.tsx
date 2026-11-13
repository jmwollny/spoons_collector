import { useEffect } from 'react';
import { ActionButton } from './ActionButton';

type ConfirmDialogProps = {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  // 'danger' for actions that delete something
  variant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Asks the user to confirm an action. Uses the same modal styling as the
 * visit form. Escape, Cancel or a click outside the dialog cancels.
 */
export const ConfirmDialog = ({
  title,
  message,
  confirmLabel,
  variant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  useEffect(() => {
    // Listens in the capture phase and stops the event, so Escape cancels
    // only this dialog and not a dialog open behind it
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onCancel]);

  return (
    <div className="visit-form-modal-backdrop" onClick={onCancel}>
      <div
        className="visit-form-modal confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-dialog-title">{title}</h2>
        <p className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="visit-form-close" onClick={onCancel}>
            Cancel
          </button>
          <ActionButton variant={variant} onClick={onConfirm}>
            {confirmLabel}
          </ActionButton>
        </div>
      </div>
    </div>
  );
};
