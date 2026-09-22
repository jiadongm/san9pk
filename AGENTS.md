# SAN9PK continuation guide

## Product purpose

The primary output is the interactive website: <https://jiadongm.github.io/san9pk/>. The repository's data, scripts and documentation support that website rather than being a separate end product.

The site helps players browse officers and assess tactic-linkage team candidates by scenario. It must distinguish verified game-data fields from community-derived mechanics and from unresolved reverse-engineering fields.

## Repository structure

- `index.html`, `assets/`: dependency-free static website. Keep it usable on GitHub Pages with only relative asset and data URLs.
- `data/`: generated runtime JSON for the website. Do not edit individual JSON files manually.
- `data-source/game-biographies.csv`: 650 game-original Traditional Chinese biographies, keyed by immutable officer slot ID and biography ID.
- `scripts/extract_game_biographies.py`: read-only extractor for `M_RtdnPK.s9` plus the `prsn` biography-ID field in `D_Sce001.S9`; never join biographies by converted names.
- `scripts/build_data.py`: converts validated analysis CSV plus the biography source into `data/` and rejects unknown officers, unavailable recommendation members and known negative pairs.
- `docs/data-dictionary.md`: public JSON schema and field meanings.
- `docs/linkage-model.md`: scoring model, evidence and limitations.
- `.github/workflows/deploy-pages.yml`: deploys the repository root to GitHub Pages when `main` is pushed.

## Data refresh

The generator needs an external analysis workspace whose structure includes `03_validation/inspections/phase1` through `phase4`. It intentionally does not copy original game binaries, scenario files or other raw game assets into this repository.

```sh
python3 scripts/build_data.py --source-root /path/to/san9pk-analysis
```

Expected generated counts are:

- 650 officers
- 20 scenarios
- 14,000 scenario-availability records
- 84 relationships
- 28 formations
- 10,471 recommendations

Run `python3 -m json.tool data/manifest.json` and inspect the generator's validation failures before committing a data refresh.

## What is currently verified

- Officer slot ID, simplified name, command, strength, intelligence, politics, affinity and tactic bitmap.
- All 650 game-original Traditional Chinese biographies. Each biography is linked through the `prsn` uint16 biography ID at byte offset 14, not through a name match. The PK and non-PK biography resources decode to the same verified text.
- Reviewed display-name corrections are keyed by officer slot ID. In particular, use `王沈` (not `王沉`), `沈莹` (not `沉莹`) and `孔伷` (not `孔侑`) as display names; preserve old game spellings only as search aliases where useful.
- Scenario start availability for 20 scenarios. Only records marked `presentAtStart` enter recommendations.
- Scenario and verified-force filters, three/five-person toggles, and user-set highest-value thresholds for command, strength, intelligence and politics.
- The 0–149 interactive affinity ring, keyboard-selectable positions and six neutral, named position anchors. Do not colour continuous affinity ranges as factions.
- 28 formation names and raw records. The semantic meaning of the raw formation fields is not fully decoded.
- Positive quantified relationships and known negative pairs. Negative pairs are excluded from recommendations; Zhong Hui plus Deng Ai is an important test case.
- Recommendation scores use circular affinity distance plus quantified intimacy. Ability values are a tie-breaker only. Five-person teams are bounded-search high-scoring candidates, not a proof of global optimum.

## Known product boundaries

- `nameTraditional` and `searchAliases` contain a 650-slot traditional-name mapping. Do not claim pinyin search until it is reliably matched.
- `biographyTraditional` is original game text, intentionally retained in Traditional Chinese with original line breaks and extension characters. Do not substitute external summaries, translate it, or run it through automatic Traditional/Simplified conversion.
- `firstAvailable` means the earliest observed historical scenario start, not a separately verified in-game "appearance year". Do not prioritize extracting or relabelling an exact appearance-year field unless the user explicitly reopens that work.
- Scenario faction ownership is verified from the original `forc`/`city`/`bldg` records. Faction-specific recommendations may use only the exported verified member pools; officers without a resolved active-force owner must remain unassigned.
- Formation hints are explanatory only. Do not turn undecoded raw values into combat weights.
- Preserve source and confidence notes. Avoid presenting community mechanics as official formulas.

## Website work

The first viewport must remain a working surface: officer search and scenario recommendation, not a marketing landing page. Maintain accessible labels, keyboard-operable controls and responsive layouts. The visual direction is a restrained historical reference tool: deep jade, vermilion accents, warm paper surfaces and readable Chinese typography.

Before a website change is complete:

1. Run `node --check assets/app.js` (use the available bundled Node runtime if `node` is absent).
2. Validate that every JSON file loaded by `assets/app.js` parses successfully.
3. Serve the repository root with a local HTTP server and check that `index.html` plus `data/recommendations.json` load successfully.
4. Test an officer search, an officer detail selection, a scenario switch and the three/five-person toggle in a browser.
5. After pushing `main`, verify both the GitHub Actions workflow and the live Pages URL. A local result or successful push is not a completed deployment.

## Git and publishing

Keep commits narrowly scoped. Do not add original game files, executable files, generated local previews, credentials or machine-specific paths. If Git signing is enabled globally but no secret key exists, prefer a repository-local signing override only when repository rules permit unsigned commits; do not change global signing settings without explicit user approval.

The Pages workflow requires GitHub Pages to use **GitHub Actions** as its publishing source. Preserve the workflow's least-privilege permissions and the `github-pages` deployment environment.

## Recommended next tasks

The completed core slice includes neutral affinity-position cards, four abilities, slot-verified Traditional names, game-original biographies, scenario/force recommendations, four ability thresholds and the affinity ring. Update `docs/roadmap.md` when changing this status.

Prioritize remaining work as follows unless the user changes direction:

1. Assess recommendation completeness after filtering. Current groups use pre-generated candidates; if that prevents users from seeing all qualifying candidates, design bounded browser-side calculation or a transparent expanded generation step. Never imply a limited pre-generated list is exhaustive.
2. Add reliably matched pinyin search, while retaining current Simplified, Traditional and reviewed legacy-spelling aliases.
3. Build optional exploratory views: four-ability single-field/total rankings, ability-range lookup, distributions/outliers, and ability clustering plus affinity/ability cross-observation. Clearly label all derived analysis as exploratory, not official game categories or formulas.
4. Continue targeted data-quality review: sample biography rendering, especially Big5-HKSCS extension characters, and add only explicit slot-ID display-name corrections. Never use whole-string automatic conversion as a corrective mechanism.
5. Do not treat exact appearance-year extraction as a pending task; the user explicitly deferred it.
