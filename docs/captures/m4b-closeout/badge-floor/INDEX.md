# J3 — value-badge legibility floor: OFF vs ON (owner A/B)

The badge floor keeps the value numerals at ≥10 device px on shrunk faces (design/badgeFloor.ts).
It ships **OFF** (`BADGE_FLOOR_DEFAULT = false`); these stills are for the owner to rule. Each pair
is the SAME state, `?badgeFloor=1` the only difference. 360×740, deviceScaleFactor 2, motion off.
Reshoot: `node apps/mobile/scripts/capture-badge-floor.mjs`.

| Scene | OFF (shipped default) | ON (candidate) |
|-------|-----------------------|----------------|
| Hand wheel, 7 cards — the value badge on each card face. | `wheel_n7_floor_off.png` | `wheel_n7_floor_on.png` |
| Hand wheel, 11 cards — the same badge at the busiest hand. | `wheel_n11_floor_off.png` | `wheel_n11_floor_on.png` |
| Late-game board — my ~38 px on-board set cascades + opponent strips (where the floor grows most). | `board_cascade_floor_off.png` | `board_cascade_floor_on.png` |

**Full-size face unaffected (proof):** `fullsize_face_floor_off.png` vs `fullsize_face_floor_on.png` are **byte-identical** (sha256 c9755c9fddeffe9c / c9755c9fddeffe9c). The floor only touches scaled-down renders.

**Owner call:** pick OFF or ON. If ON, flip `BADGE_FLOOR_DEFAULT` to `true` (one line).
