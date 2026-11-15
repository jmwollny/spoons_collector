import './StarIcon.css';

type StarIconProps = {
  // Which star, from 0
  id: number;
  rated: boolean;
  size?: number;
  // Display only: not clickable or focusable
  disabled?: boolean;
  onClicked?: (id: number) => void;
  // What clicking it does, for screen readers, e.g. "Rate 2 out of 3"
  label?: string;
};

const DEFAULT_SIZE = 40;

const STAR_PATH =
  'M256 38.013c-22.458 0-66.472 110.3-84.64 123.502-18.17 13.2-136.674 20.975-143.614 42.334-6.94 21.358 84.362 97.303 91.302 118.662 6.94 21.36-22.286 136.465-4.116 149.665 18.17 13.2 118.61-50.164 141.068-50.164 22.458 0 122.9 63.365 141.068 50.164 18.17-13.2-11.056-128.306-4.116-149.665 6.94-21.36 98.242-97.304 91.302-118.663-6.94-21.36-125.444-29.134-143.613-42.335-18.168-13.2-62.182-123.502-84.64-123.502z';

/** One star of a rating. Clickable (and usable from the keyboard) unless disabled. */
const StarIcon = ({ id, rated, size, disabled = false, onClicked, label }: StarIconProps) => {
  const pixels = `${size && size > 0 ? size : DEFAULT_SIZE}px`;
  const click = () => {
    if (!disabled) onClicked?.(id);
  };

  return (
    <svg
      onClick={click}
      width={pixels}
      height={pixels}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      {...(disabled
        ? { 'aria-hidden': true }
        : {
            role: 'button',
            tabIndex: 0,
            'aria-label': label,
            'aria-pressed': rated,
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                click();
              }
            },
          })}
    >
      <path
        className={`star ${rated ? 'rated' : 'unrated'}${disabled ? ' aria-disabled' : ''}`}
        d={STAR_PATH}
      />
    </svg>
  );
};

export default StarIcon;
