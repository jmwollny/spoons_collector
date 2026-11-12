import { useEffect, useState } from 'react';
import StarIcon from './StarIcon';

type PropsType = {
  maxRating: number;
  rating: number;
  size?: number;
  disabled?: boolean
  onClicked?: (rating: number) => void;
};

const StarRating = (props: PropsType) => {
  const [rating, setRating] = useState(props.rating); // -1 means no rating, 0 means first star, 1 means second star, 2 means third star

  useEffect(() => {
    setRating(props.rating);
  }, [props.rating]);

  const onRatingUpdated = (id: number) => {
    // Clear the rating if the same lowest star is clicked again
    let newRating = id;
    if (rating === 0 && id === 0) {
      newRating = -1;
    }

    setRating(newRating);
    if (props.onClicked) {
      props.onClicked(newRating);
    }
  };

  const renderIcons = () => {
    const icons = [];
    for (let i = 0; i < props.maxRating; i++) {
      if (i <= rating) {
        icons.push(<StarIcon disabled={props.disabled} size={props.size} key={i} id={i} onClicked={onRatingUpdated} rated={true}/>);
      } else {
        icons.push(<StarIcon disabled={props.disabled} size={props.size} key={i} id={i} onClicked={onRatingUpdated} rated={false}/>);
      }
    }
    return icons;
  }
  return (
    <div>
      {renderIcons()}
    </div>
  );
};

export default StarRating;