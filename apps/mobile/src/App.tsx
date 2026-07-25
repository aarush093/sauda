import { useGame } from './game/store';
import { Home } from './components/Home';
import { Table } from './components/Table';
import { PlateSheet } from './components/PlateSheet';

export function App() {
  const state = useGame((store) => store.state);
  // Dev-only route for the M4 plate review: open with #/dev/plates.
  if (typeof window !== 'undefined' && window.location.hash === '#/dev/plates') {
    return <PlateSheet />;
  }
  return <div className="app">{state === null ? <Home /> : <Table />}</div>;
}
