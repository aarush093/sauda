# M4c — Motion backlog

The one motion carve-out that shipped in M4b is the **G2 wheel redistribution transition**
(transform-only, ~175ms ease-out — the "seamless readjustment" the owner asked for). Everything
below is deferred motion/juice for **M4c**, where the full fx layer (the §9 timing table, sounds,
haptics, the stamp-slam) lands. Nothing here is a bug; it is guidance/polish captured so it is not
forgotten.

## Deferred motion

- **Munshi's-pick bouncing arrow (G7, owner playtest 2).** On the payment sheet, the suggested
  (Munshi) selection ships with a static gold ◈ seal + a "Munshi's pick — tap Pay" line. The owner
  asked for a small **bouncing arrow** pointing at the Pay button as live guidance juice. Deferred
  to M4c (it is animation, not logic).
- **Wheel peek ease (G2 / F1).** The scrubbed card lifts INSTANTLY today (the peek transform is
  applied with no transition, on the inner layer, so it never rides the redistribution ease). The
  dedicated ~90ms peek ease-in is M4c.
- **Card-arrival / received-card motion (G6).** A card paid to me flashes on the stage for a beat
  today (static). The "flies from the payer's column to mine" travel animation (matrix I2) is M4c.
- **Full-screen overlay transitions (G3 discard · G4 table view).** These open/close instantly with
  a static scrim + blur. Their slide/fade-in is M4c.
- **Stamp-slam victory + FULL-ribbon slide + drop-zone/commit feedback** — all per the STATE_MATRIX
  feedback column and INTERACTION_SPEC §9/§10, unchanged and still M4c.

_Created for G7 (owner playtest 2); expand as further motion is deferred._
