/** The pub's name along the top of a card face, with a Visited badge */
export const CardHeader = ({ name, visited }: { name: string; visited: boolean }) => (
  <header className="card-header">
    <h2 className="card-title" title={name}>
      {name}
    </h2>
    {visited && <span className="visited-badge">Visited</span>}
  </header>
);
