import { useId, type ReactNode } from 'react';
import { useDismiss } from '../hooks/useDismiss';

type ModalProps = {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  // Extra class for the panel, e.g. to set its width
  className?: string;
  // 'alertdialog' for confirmations
  role?: 'dialog' | 'alertdialog';
  // The header's close button; null for none (e.g. a confirmation, which
  // has its own Cancel)
  closeLabel?: string | null;
};

/**
 * A dialog over the page. Escape, the Android Back button, the close
 * button or a tap outside the panel closes it.
 */
export const Modal = ({
  title,
  onClose,
  children,
  className = '',
  role = 'dialog',
  closeLabel = 'Close',
}: ModalProps) => {
  const titleId = useId();
  useDismiss(onClose);

  const heading = <h2 id={titleId}>{title}</h2>;

  return (
    <div className="visit-form-modal-backdrop" onClick={onClose}>
      <div
        className={`visit-form-modal ${className}`}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        {closeLabel ? (
          <div className="visit-form-modal-header">
            {heading}
            <button type="button" className="visit-form-close" onClick={onClose}>
              {closeLabel}
            </button>
          </div>
        ) : (
          heading
        )}
        {children}
      </div>
    </div>
  );
};
