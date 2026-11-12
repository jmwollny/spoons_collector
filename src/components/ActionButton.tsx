import './ActionButton.css';

type ActionButtonProps = {
  children: React.ReactNode;
  variant?: 'primary' | 'danger';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  onClick?: () => void;
};

export const ActionButton = ({
  children,
  variant = 'primary',
  type = 'button',
  disabled = false,
  onClick,
}: ActionButtonProps) => {
  return (
    <button
      type={type}
      className={`action-button action-button--${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
