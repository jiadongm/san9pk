# SAN9PK continuation guide

## Product purpose

The primary output is the interactive website: <https://jiadongm.github.io/san9pk/>. The repository's data, scripts and documentation support that website rather than being a separate end product.

The site helps players browse officers and assess tactic-linkage team candidates by scenario. It must distinguish verified game-data fields from community-derived mechanics and from unresolved reverse-engineering fields.

## Repository structure

- `index.html`, `assets/`: dependency-free static website. Keep it usable on GitHub Pages with only relative asset and data URLs.
- `data/`: generated runtime JSON for the website. Do not edit individual JSON files manually.
- `scripts/build_data.py`: converts validated analysis CSV into `data/` and rejects unknown officers, unavailable recommendation members and known negative pairs.
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
- 400 recommendations

Run `python3 -m json.tool data/manifest.json` and inspect the generator's validation failures before committing a data refresh.

## What is currently verified

- Officer slot ID, simplified name, command, strength, intelligence, politics, affinity and tactic bitmap.
- Scenario start availability for 20 scenarios. Only records marked `presentAtStart` enter recommendations.
- 28 formation names and raw records. The semantic meaning of the raw formation fields is not fully decoded.
- Positive quantified relationships and known negative pairs. Negative pairs are excluded from recommendations; Zhong Hui plus Deng Ai is an important test case.
- Recommendation scores use circular affinity distance plus quantified intimacy. Ability values are a tie-breaker only. Five-person teams are bounded-search high-scoring candidates, not a proof of global optimum.

## Known product boundaries

- `nameTraditional` and `searchAliases` contain a 650-slot traditional-name mapping. Do not claim pinyin search until it is reliably matched.
- Game-original biographies have not yet been extracted. Do not display or describe external biographical summaries as game text.
- Faction ownership has not been reliably extracted. Do not add a faction selector or faction-specific recommendations using guessed data.
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

The maintained implementation order is recorded in `docs/roadmap.md`. Follow it unless the user explicitly changes priorities.

The immediate product slice is:

1. Replace the affinity progress bar with a neutral circular-position treatment, add politics to officer cards, and reliably join reviewed Traditional Chinese names to the 650 officer IDs. Add biographies only after extracting and validating game-original text.
2. Reverse engineer and validate faction membership per scenario before adding the scenario-plus-faction recommendation flow.
3. Add explicit team ability thresholds, beginning with user-set minimum requirements for each team's highest command, strength, intelligence and politics values.
4. Build the interactive 0–149 affinity ring only after the core officer and recommendation surfaces are correct and usable.
5. Treat rankings, range lookup and clustering as later exploratory views. Label derived clusters as analysis, never as official game categories.
