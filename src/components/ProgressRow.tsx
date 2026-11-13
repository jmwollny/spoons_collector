type ProgressRowProps = {
  label: string;
  visited: number;
  total: number;
  // Bar colour; defaults to the app's blue
  color?: string;
};

/** One line of a progress list: label, "visited/total" and a filled bar */
export const ProgressRow = ({ label, visited, total, color }: ProgressRowProps) => {
  const percentage = total > 0 ? Math.round((visited / total) * 100) : 0;
  return (
    <li className="progress-row">
      <div className="progress-row-text">
        <strong>{label}</strong>
        <span>
          {visited}/{total}
        </span>
      </div>
      <div
        className="progress-bar"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={visited}
      >
        <div
          className="progress-bar-fill"
          style={{ width: `${percentage}%`, ...(color ? { background: color } : {}) }}
        />
      </div>
    </li>
  );
};
