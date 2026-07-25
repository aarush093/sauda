import { useState } from 'react';
import { GAME } from '@sauda/engine';
import type { Difficulty } from '@sauda/bots';
import { useGame } from '../game/store';
import type { SeatConfig } from '../game/store';

type Mode = 'solo' | 'passAndPlay';

// The New Game screen: pick a mode and a player count, then start. All the actual
// game setup happens in the engine (createGame) via the store.
export function Home() {
  const newGame = useGame((store) => store.newGame);
  const [mode, setMode] = useState<Mode>('solo');
  const [opponents, setOpponents] = useState(3); // solo: number of bots
  const [humans, setHumans] = useState(2); // pass-and-play: number of humans
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');

  function start() {
    const seats: SeatConfig[] = [];
    if (mode === 'solo') {
      seats.push({ kind: 'human' });
      for (let i = 0; i < opponents; i++) {
        seats.push({ kind: 'bot', difficulty });
      }
    } else {
      for (let i = 0; i < humans; i++) {
        seats.push({ kind: 'human' });
      }
    }
    // Any seed works for play; the engine is deterministic given it.
    const seed = Math.floor(Math.random() * 1_000_000_000);
    newGame({ seats, seed });
  }

  return (
    <div className="home">
      <h1>{GAME.name}</h1>
      <p className="tagline">{GAME.tagline}</p>

      <fieldset>
        <legend>Mode</legend>
        <label>
          <input type="radio" checked={mode === 'solo'} onChange={() => setMode('solo')} />
          Solo (you vs bots)
        </label>
        <label>
          <input
            type="radio"
            checked={mode === 'passAndPlay'}
            onChange={() => setMode('passAndPlay')}
          />
          Pass &amp; play
        </label>
      </fieldset>

      {mode === 'solo' ? (
        <fieldset>
          <legend>Opponents</legend>
          <label>
            Bots:
            <select value={opponents} onChange={(e) => setOpponents(Number(e.target.value))}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
          <label>
            Difficulty:
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
        </fieldset>
      ) : (
        <fieldset>
          <legend>Players</legend>
          <label>
            Humans:
            <select value={humans} onChange={(e) => setHumans(Number(e.target.value))}>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </label>
        </fieldset>
      )}

      <button className="start" onClick={start}>
        Start game
      </button>
    </div>
  );
}
