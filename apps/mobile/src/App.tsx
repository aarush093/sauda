import { useGame } from './game/store';
import { Home } from './components/Home';
import { Table } from './components/Table';
import { PlateSheet } from './components/PlateSheet';
import { CardFace } from './components/CardFace';
import { INK } from './design/tokens';

export function App() {
  const state = useGame((store) => store.state);
  const hash = typeof window !== 'undefined' ? window.location.hash : '';

  // Dev-only routes for M4 art review.
  if (hash.startsWith('#/dev/card/')) {
    const cardId = hash.slice('#/dev/card/'.length);
    return (
      <div style={{ minHeight: '100vh', background: INK.tableIndigo, padding: 32 }}>
        <div style={{ transform: 'scale(3)', transformOrigin: 'top left' }}>
          <CardFace cardId={cardId} size="full" />
        </div>
      </div>
    );
  }
  if (hash === '#/dev/plates') {
    return <PlateSheet />;
  }

  return <div className="app">{state === null ? <Home /> : <Table />}</div>;
}
