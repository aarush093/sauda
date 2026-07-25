import { useGame } from './game/store';
import { Home } from './components/Home';
import { Table } from './components/Table';

export function App() {
  const state = useGame((store) => store.state);
  return <div className="app">{state === null ? <Home /> : <Table />}</div>;
}
