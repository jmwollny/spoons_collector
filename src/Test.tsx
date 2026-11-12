import { useState } from 'react';
import StarRating from './components/StarRating';

function App() {
  const [rating, setRating] = useState(-1);

  function onRatingUpdated(newRating: number): void {
    console.log('Rating updated:', newRating);
    setRating(newRating);
  }

  return (
    <div className="app-shell">
      <StarRating rating={rating} maxRating={6} onClicked={onRatingUpdated} />
    </div>
  );
}

export default App;

