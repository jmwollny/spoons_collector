import StarIcon from './StarIcon';

type StarRatingProps = {
  maxRating: number;
  // -1 for no rating, 0 for one star, 1 for two, and so on
  rating: number;
  size?: number;
  // Display only
  disabled?: boolean;
  // The new rating; -1 when the user clears it
  onClicked?: (rating: number) => void;
};

/**
 * A row of stars. Clicking a star rates up to it; clicking the first star
 * again when it's the only one lit clears the rating.
 */
const StarRating = ({ maxRating, rating, size, disabled = false, onClicked }: StarRatingProps) => {
  const choose = (id: number) => {
    onClicked?.(rating === 0 && id === 0 ? -1 : id);
  };

  const stars = Array.from({ length: maxRating }, (_, index) => (
    <StarIcon
      key={index}
      id={index}
      rated={index <= rating}
      size={size}
      disabled={disabled}
      onClicked={choose}
      label={`Rate ${index + 1} out of ${maxRating}`}
    />
  ));

  return disabled ? (
    <div role="img" aria-label={rating < 0 ? 'Not rated' : `Rated ${rating + 1} out of ${maxRating}`}>
      {stars}
    </div>
  ) : (
    <div role="group" aria-label="Rating">
      {stars}
    </div>
  );
};

export default StarRating;
