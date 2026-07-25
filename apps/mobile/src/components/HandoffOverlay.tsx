/**
 * Pass-and-play privacy screen. Between two different human players it covers the
 * board so the next player doesn't see the previous player's hand, until they tap
 * "I'm ready".
 */
export function HandoffOverlay({ seat, onReady }: { seat: number; onReady: () => void }) {
  return (
    <div className="overlay">
      <h2>Pass the device to Player {seat}</h2>
      <p>Keep it hidden from everyone else.</p>
      <button onClick={onReady}>I&rsquo;m Player {seat} — ready</button>
    </div>
  );
}
