import type { AppView } from '../hooks/useAppView';
import './TabBar.css';

const TABS: { view: AppView; icon: string; label: string }[] = [
  { view: 'map', icon: '🗺️', label: 'Map' },
  { view: 'cards', icon: '🃏', label: 'Cards' },
  { view: 'stats', icon: '📊', label: 'Stats' },
];

type TabBarProps = {
  view: AppView;
  onChange: (view: AppView) => void;
};

/** The bar along the bottom of a phone's screen, switching between views */
export const TabBar = ({ view, onChange }: TabBarProps) => (
  <nav className="tab-bar" aria-label="Views">
    {TABS.map((tab) => (
      <button
        key={tab.view}
        type="button"
        className={`tab-bar-button ${tab.view === view ? 'is-active' : ''}`}
        aria-current={tab.view === view ? 'page' : undefined}
        onClick={() => onChange(tab.view)}
      >
        <span className="tab-bar-icon" aria-hidden="true">
          {tab.icon}
        </span>
        <span>{tab.label}</span>
      </button>
    ))}
  </nav>
);
