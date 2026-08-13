/**
 * Opponent-cash redaction (S2 — owner directive, 13 Aug). In this genre bank totals are traditionally
 * PUBLIC; the owner is deliberately diverging so a hidden bankroll creates bluff tension (recorded in
 * DECISIONS "S2"). The rule: an opponent's exact cash is PRIVATE. What IS public is how MANY notes
 * they hold — you can see the size of someone's stack, you just can't read the values.
 *
 * This is the single UI place that turns an opponent bank into text. It NEVER emits a ₹ total. The
 * redaction lives entirely here, over the engine's existing Observation — packages/engine is
 * byte-identical (the OpponentView still carries bankTotal; the UI simply declines to show it).
 *
 * EXCEPTION (not handled here): debts stay explicit. What a bot pays ME / owes ME is shown with real
 * amounts and faces by the payment sheet and received-card flow — only STANDING totals are hidden.
 */

// A small note-stack glyph (tokens-only text mark; distinct from the sets mark "▦"). Prefixes the
// public COUNT of banked cards on the rail and in an opponent's zoom.
export const NOTE_STACK_GLYPH = '▤';

// The redacted phrase for a banking event in the ticker / spectate caption — "banked a note", never a
// value. A banked card is now face-DOWN to opponents, so neither its worth nor its identity leaks.
export const BANKED_A_NOTE = 'a note';

// The public label for an opponent's bank: the note-stack glyph + the COUNT of banked cards. This is
// the ONLY thing the rail / opponent zoom may say about their cash — no ₹, no total, ever.
export function opponentBankLabel(bankCount: number): string {
  return `${NOTE_STACK_GLYPH} ${bankCount}`;
}
