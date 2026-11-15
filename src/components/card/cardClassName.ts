import type { SpoonCardProps } from '../SpoonCard';

/** The card's classes: rarity, size and state, for SpoonCard.css */
export const spoonCardClassName = (props: SpoonCardProps) =>
  [
    'spoon-card',
    `rarity-${props.rarity.toLowerCase()}`,
    !props.visited && 'unvisited',
    props.small && 'small',
    props.medium && 'medium',
    props.full && 'full',
    props.compact && 'compact',
    props.selected && 'selected',
    props.flipped && 'is-flipped',
  ]
    .filter(Boolean)
    .join(' ');
