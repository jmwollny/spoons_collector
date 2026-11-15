import { useState } from 'react';
import type { MonthCount } from '../../stats';
import { plural } from '../../utils';

/**
 * Visits per month as a column chart. One series, so one colour and no
 * legend; the busiest month is labelled, and every month shows its numbers
 * on hover or keyboard focus. A table gives the same numbers to screen
 * readers.
 */
export const MonthChart = ({ months }: { months: MonthCount[] }) => {
  const [active, setActive] = useState<number | null>(null);
  const most = Math.max(0, ...months.map((month) => month.visits));
  const peak = most > 0 ? months.findIndex((month) => month.visits === most) : -1;
  const describe = (month: MonthCount) =>
    `${month.label} ${month.year}: ${plural(month.visits, 'visit')}, ${plural(month.newPubs, 'new pub')}`;

  return (
    <figure className="month-chart">
      <figcaption className="month-chart-title">Visits per month</figcaption>
      <div className="month-chart-tooltip" aria-hidden="true">
        {active !== null ? describe(months[active]) : ' '}
      </div>
      <div className="month-chart-plot" aria-hidden="true">
        {months.map((month, index) => (
          <div
            key={month.key}
            className={`month-chart-column ${active === index ? 'is-active' : ''}`}
            tabIndex={0}
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
          >
            {index === peak && <span className="month-chart-peak">{month.visits}</span>}
            <div
              className="month-chart-bar"
              style={{ height: most > 0 ? `${(month.visits / most) * 100}%` : '0%' }}
            />
            <span className="month-chart-label">{month.label.charAt(0)}</span>
          </div>
        ))}
      </div>
      <table className="visually-hidden">
        <caption>Visits per month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Visits</th>
            <th scope="col">New pubs</th>
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.key}>
              <th scope="row">
                {month.label} {month.year}
              </th>
              <td>{month.visits}</td>
              <td>{month.newPubs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
};
