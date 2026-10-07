# Festival programmes: current coverage and remaining gaps

The 7 October 2026 source audit recovered the static programmes and awards below
from official publications. The versioned supplement is reproducible; the
[release audit](SOURCE_COVERAGE_AUDIT_2026-10-07.md) records its import and public
verification. An official file from the user is no longer needed for TIFF,
Sundance, Berlinale or the other programmes already recovered.

| Festival / edition | Feature programme entries | Award entries | Scope and remaining gaps |
|---|---:|---:|---|
| Sundance 2026 | 90 | 29 | Official features; award names cleaned from their source, jury quotations and the honorary award excluded. |
| Berlinale 2026 | 149 | 21 | Eligible features from the official archive; shorts, classics and honorary programmes excluded. |
| Cannes 2026 | 76 | 16 | Official Selection beyond Competition; independent parallel organisations remain separate. |
| Locarno 2026 | 63 | 31 | Partial: five sections from the festival's official Letterboxd account, linked by its own site. Open Doors and other sections remain to verify. |
| Venice 2026 | 91 | 16 | Existing official selection and recovered official feature awards. |
| TIFF 2026 | 206 | 20 | Eligible features from the official downloadable programme; original section labels and awards, including published mentions and runners-up. |
| San Sebastián 2026 | 141 | 35 | Eligible films from the official project archive and official published awards, including audience and parallel juries. |
| Telluride 2026 | 43 | — | 35 Shows and 8 Backlot; non-competitive. |
| NYFF 2026 | 34 | — | Main Slate only; Spotlight and Currents remain to verify. Non-competitive; the edition is still running on the audit date. |

Counts describe programme or award entries, not unique films or a claim that the
whole circuit is exhaustive. A film can receive more than one award. The scope
continues to exclude shorts, episodes, immersive work, restorations, honorary
tributes and industry events.

## Useful additions

The next useful material is Locarno's missing official feature sections and
NYFF's current Spotlight and Currents programmes. Official addenda and corrections
for any of the nine editions are also useful. Prefer the original official URL,
PDF or saved page; an optional transcription does not replace that receipt.

Preserve edition and section names, original film title, director or recipient,
format or runtime, exact award name, publication date when shown and capture
date. Leave unknown values blank. Keep joint winners, special mentions and
runners-up distinct. Do not infer an Oscar nomination or eligibility from a
festival selection.

## Import and corrections

Use `npm run festivals:import --
web/data/festivals/2026-supplement-2026-10-07.json` for this supplement. Closed
editions with verified static receipts are archived rather than overwritten by
partial daily scrapes. NYFF remains active; a partial refresh must not replace a
larger verified programme. Older receipts, exact originals and matching history
remain immutable. Repeating an import creates no duplicate version; ambiguous
film matches remain unlinked until reviewed.

Festival programmes and awards are context, separate from expert predictions,
critical reception and user ballots. See the
[research receipts](audits/2026-10-07/festival-research.md) and
[methodology](METHODOLOGY.md).
