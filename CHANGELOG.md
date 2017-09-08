# CHANGELOG

## Emoji Cheatsheet
- :pencil2: doc updates
- :bug: when fixing a bug
- :rocket: when making general improvements
- :white_check_mark: when adding tests
- :arrow_up: when upgrading dependencies
- :tada: when adding new features

## Version History

### v11.20.7

- :bug: fix `N` results in test mode (thx @boblannon!) 

### v11.20.6

- :tada: add SOFT & HARD modes to `NAME MISMATCH` output
- :rocket: make `NAME MISMATCH` errors less needlessly verbose

### v11.20.5

- :bug: fix & further optimize adoption code
- :white_check_mark: add more adoption tests to cluster

### v11.20.4

- :rocket: Optimize cluster#adoption query with `name_uniqueness` WHERE clause

### v11.20.3

- :white_check_mark: Added Unit module tests

### v11.20.2

- :bug: Tilebelt function name needs to be capitalized.

### v11.20.1

- :rocket: Short-Circuit cluster#break calculation is line distance is less than 1
- :bug: cluster#break change to >= & <= to avoid hard error if xInt was 0

### v11.20.0

- :rocket: Detect Duplicate `> 1km` in distance apart.
- :rocket: If no duplicates are detected fallback to current `explode#split` module
- :rocket: if duplicates are detected pass to to-be-written `cluster#split` module

### v11.19.1

- :bug: Fix bug where `explode#split` would drop a section of the LineString

### v11.19.0

- :rocket: New deterministic ASCII based unit lookup encoder/decoder

### v11.18.0

- :rocket: Change split distance to 500m
- :rocket: Refactor `explode` module with better tests and modularity

### v11.17.0

- :arrow_up: Update `pg` to major version `7.x` from `6.x` and bump `tmp` version
- :rocket: Rewrite orphan code to into generic Orphan class
- :tada: Add network orphan creation in addition to the current address_cluster orphan code (Network clusters not matched to an address cluster will be output with no ITP data)

### v11.16.1

- :bug: :white_check_mark: handle cardinal directions (NW/NE/SW/SE) better in titlecase code & improve multilingual interface & warnings to it

### v11.16.0

- :pencil2: Doc :hammer: ! Enforce JSDocs on all defined functions
- :pencil2: Doc all current functions to pass the above added test
- :rocket: Strip out dedupe function from split and re-impliment as a `post` function to give the `interpolate` module more signal and also allow further code isolation and testing.

### v11.15.1

- :bug: only discard duplicate house number sets when there is >1km separation between them
- :rocket: of the remaining duplicate house number sets, only geocode the first entry (doing the rest is pointless)

### v11.15.0

- :arrow_up: Adds DocumentationJS as Dev Dep
- :pencil2: Add documentation js linting to circle and fix all bad JSDoc strings

### v11.14.0

- :rocket: Don't pick linker matches arbitrarily, instead return ties to match.js and let it break ties using the buffer geom

### v11.13.0

- :rocket: optionally preserve 'source' attribute from address geojson

### v11.12.2

- :bug: better handling of titlecasing of labels

### v11.12.1

- :bug: testmode syntax error :disappointed:

### v11.12.0

- :tada: changes to test mode: CSV output & tokenless mode as default behavior

### v11.11.3

- :bug: Prune before orphan address stage to prevent fragmentation between db and geojson

### v11.11.2

- :white_check_mark: Adds the first split unit tests

### v11.11.1

- :arrow_up: Update to latest deps
- :bug: `label` module was uppercases letter after an `'`. IE: `Helen's` => `Helen'S`

### v11.11.0


- :bug: a call to `turf.linestring` failed when passed a one-coordinate feature. This was the result of a call to `dedup()` which was being passed a two-point line of coordinates that had been truncated enough to be identical. `dedup` removed one of them, producing the error. This case is now detected and handled.
- :bug: `split.js` was producing weird errors related to `proc.c` and `InitProcess`. This looked like postgres connection exhaustion. Initially I implemented a system for calling the postgres pool shutdown function. That code remains in place (it's good hygiene!) but was not the issue: instead, the split.js parallelism based on CPU count was the culprit, as each child process instantiated its own postgres connection pool and I was on a 64 core ECS container. Capping the total number of child processes to 16 is inelegant but seems to do the trick.

### v11.10.1

- :rocket: :white_check_mark: Remove the `1/2` from numbers - numbers are deduped if they already exist in the non-`1/2` form.

### v11.10.0

- :bug: fix titlecase behavior (remove external dep)
- :white_check_mark: titlecase tests
- :tada: add pluggable system for selecting output label
- :rocket: whitespace fixes & eslint rule
- :rocket: make informed guess about which data source has more/better capitalization info

### v11.9.0

- :arrow_up: Upgrade all deps to latest versions
- :white_check_mark: :bug: Complete tests for `minjur` and `strip-unit` map files & fixed a couple assoc. bugs
- :rocket: :white_check_mark: Added concept of post scripts and assoc. tests
- :rocket: Added cardinality post script ie: `S Main St` => `S Main St,Main  ST S`

### v11.8.0

- :rocket: Better readability of `TEXT FAIL` mismatch when in `test` mode
- :arrow_up: Update to latest geocoder-abbr version (1.7.0)
- :rocket: Remove tabs from `test` and fix indentation

### v11.7.1

- :bug: Restore `debug` property on `map` module output when `--debug` is passed

### v11.7.0

- :white_check_mark: Comprehensive tests for strip-unit
- :tada: support `123 B` => `123B` Address conversions (Common in Canada Data)

### v11.6.2

- :white_check_mark: tests for copy.js
- :bug: correctly populate text_tokenless in `address_cluster` & `address` tables
- :bug: handle all-token case properly in `cluster.prune()`
- :rocket: move token replacer creation code into `tokenize.js`

### v11.6.1

- :arrow_up: Update to latest `carmen` and `geocoder-abbreviations`

### v11.6.0

- :rocket: Add address deduping to `strip` module as they aren't desireable in our output
- :tada: Add `--name` option to test mode to allow more flexibility in text comparison pass/fail criteria

### v11.5.0

- :tada: :white_check_mark: added pruning to ensure only 1 network_cluster is matched to a given address_cluster.
- :rocket: adjusted linker constraints to improve matches.

### v11.4.1

- :rocket: optimized adoption query

### v11.4.0

- :arrow_up: Upgrade all deps

### v11.3.0

- :tada: Add adoption module which grabs address clusters that were too far apart from another to be joined along a single ultralong network cluster

### v11.2.0

- :rocket: Zoom to map bounds on first open of debug

### v11.1.0

- :rocket: uses the callback functionality of `process.stdout.write` to throttle writing so that it only occurs after the previous write is flushed. I don't think this helps but it's not a bad idea.
- :rocket: uses the `split` module in the parent/orchestrating process to (hopefully) only write whole-line chunks to the output file

### v11.0.0

- :rocket: ITP segments are now allowed to exceeds the min/max addresses at the calculated start/end points to get a better range
    - IE: `22 => 96` would potentially become `0 => 100`.
    - Although this doesn't change the output format or cli options the data is drastically different from the 10x series - hence the major version

### v10.0.1

- :bug: `strip` mode - Don't ouput geometry if it was only points - empty array

### v10.0.0

- :bug: Fix arg parsing in `convert` module that would allow process array to be used instead of minimist parsed object.
- :tada: Add `strip` mode to remove address points for testing or obtaining ITP only results

### v9.30.1

- :bug: Fix reverse lookup of ITP in `debug` mode

### v9.30.0

- :tada: Generic ID fxn
- :white_check_mark: Fix tests around linker bug

### v9.29.3

- :arrow_up: Update ESLint to 4.x version

### v9.29.2

- :bug: Retain fallback random `id` to ensure all feats are id'd

### v9.29.1

- :bug: Switch to id calc based on bounds as some geoms have the same centre as houses on the block can have an address
        for two streets and it just happened they were both used for the centre calc.

### v9.29.0

- :rocket: Use parallel fxns for segmentation
- :tada: Rewrite `split` function to run in a child process greatly speeding up the last interpolation step.

### v9.28.0

- :tada: Massive rewrite of index.copy to distribute accross child processes
- :rocket: segment in queue to allow some parallel Postgres queries
- :rocket: optimize in queue to allow some parallel Postgres queries

### v9.27.0

- :rocket: More random & evenly distributed ID generation
- :rocket: Replace ID generation with centralized `misc.id` fxn
- :white_check_mark: Add `misc.id` tests

### v9.26.0

- :tada: Massive rewrite of cross matching function to run in parallel

### v9.25.0

- :rocket: exposes _text fields for comparison (linker)
- :rocket: removes diacritics & lcases (linker)

### v9.24.2

- :bug: Reintroduce accidently dropped support for global tokens

### v9.24.1

- :bug: Change `test` mode to new tokenize fxn - previsouly caused test mode to fatally err.

### v9.24.0

- :rocket: adds a `lib/geocode.js` that takes `lib/test.js`-like set of parameters to geocode a single query
- :rocket: modularizes geocoding capability too
- :tada: adds `--limit` param to `test.js`
- :rocket: weight linker comparisons to deemphasize mismatches based purely on tokens
    - adds `text_tokenless` column to `address_cluster` & `network_cluster` tables
    - handle all-token special case by checking for substring status
- :rocket: detection of candidate address_clusters now uses `ST_Intersects` instead of `ST_Contains`
- :bug: fix JS error in web interface related to features w/o itp data

### v9.23.1

- :bug: Using global tokens would break `test` mode

### v9.23.0
- :tada: Added support for global tokens, for e.g. talstrasse -> tal str, tal strasse
- :white_check_mark: Added tests to make sure this behaviour is followed

### v9.22.1

- :rocket: Remove outdated getNames() call

### v9.22.0

- :rocket: Show street name of viewed feature
- :rocket: Allow searching by lat/lng in search box

### v9.21.1

- :bug: bugfix for zero-distance results in `test.js` mode

### v9.21.0
- :rocket: Reduced the value of the distance in ST_clusterWithin used for network and address clusters, to prevent roads and points far away from each other from being clustered together
- :white_check_mark: added tests to make sure this behaviour is followed

### v9.20.0

- :white_check_mark: Add tests for hooked roads
- :rocket: Take highest/lowest number off end of road into consideration when generating ITP

### v9.19.1

- :rocket: Clean up strip-unit (dup code)
- :rocket: Add in memory number limits

### v9.19.0

- :rocket: Limit precision of coordinates to avoid `NUMERIC` overflows
- :rocket: `number` (civic address) are only allowed to be 10 chars long to reduce bad data - can bump in the future if needed
- :rocket: Unnamed large streets are allowed
- :tada: Add CONTRIBUTING doc to ensure versions are bumped
- :bug: Ensure output of test is prefixed to working dir

### v9.18.0

- :tada: Add diacritic handling to both the test mode & std. `street` field
- rocket: Use `address._text` as definitive name and add `network._text` as syn when they differ
- :bug: Make `psv` files in `lib/copy` have unique names so pt2itp can run in parallel
- :rocket: `test` mode now outputs when network and address text differ as an error

### v9.17.1

- :bug: Don't alter `_text` value with tokens as it is displayed to the user
- :pencil2: Fix `test` mode docs with new options

### v9.17.0

- :rocket: Moves token management to a central shared repo

### v9.16.1

- :bug: Fix bug where assignment wouldn't happen even if score > .4

### v9.16.0

- :bug: Allow `debug` mode from any relative path - use to break as `./web` was hardcoded as static dir
- :tada: remove all `freq` calculations and replace with a much more accurate Liechtenstein distance percent.
  - This change is pretty large and will drastically affect matches in all countries.
  - Before matches were calculated by sorting potentials with the calculated frequency of token matches. This worked well if everything was spelled correctly and helped ensure `st` vs `av` errors still lead to a match. It did however also allow things like `Margaret St` and `Shepherd St` to match on the `ST` token alone.
  - This uses lev. dist to generate a percent with a hard cutoff on if the match can take place or not. From a lot of groking the results 40% matches and above seem like a good first start.

### v9.15.0

- :rocket: Show unmatched addresses in `test` output - these are all bugs/data problems
- :tada: Title case all `street` props
- :rocket: Allow named `highway=service` features in minjur map module.
- :rocket: Use proto to avoid having to pass pool in each time

### v9.14.0

- :rocket: Improved testing mode using database as source for matched addresses
- :rocket: Queue addresses to allow control of # of requests against carmen
- :rocket: Better token support
- :tada: Add `meta` table to allow subsequent modes to access initial metadata
- :arrow_up: Update carmen & d3-queue to latest versions
- :tada: Add large number of new `id` tokens

### v9.13.0

- :tada: Add geojson viewer to the visual debugger

### v9.12.2

- :bug: Fix coord that could become `NaN`

### v9.12.1

- :bug: Missed a merge conflict which node really didn't appreciate

### v9.12.0

- :tada: `map` module now exposes `--error` flag which will print a reason (and the feature) that was dropped/couldn't be processed

### v9.11.0

- `strip-unit` also strips out addresses with invalid coords (OA Australia)

### v9.10.1

- :arrow_up: Update `carmen@22.1.3` and `turf@4.2.0`

### v9.10.0

- :tada: add `stat` module for calculating useful numbers from generated ITP files

### v9.9.0

- :rocket: Change the way 1km distance thresh. is calculated in explode.js to be more uniform and avoid orphaned short segs inbetween longer 1km segs.

### v9.8.0

- :rocket: `debug` mode of interpolation.js now writes to `.debug` property with a node for l/r start/end addresses with `left`, `right`, `start`, `end` boolean properties
           this can optionally be consumed by `debug` mode (makes it farrr more useful than without `--debug` flag)
- :bug: `explode` module was shirking its duty due to the fact that a `FeatureCollection` of `LineStrings` were being passing instead of `MultiLineStrings`. It's been talked to.

### v9.7.0

- :tada: Add `debug` interface and web backend

### v9.6.0

- :tada: Streets are now run through `explode` in an attempt to join them into longer segments
- :tada: Collections aggregated only if address pts within the cluster don't conflict with each other

### v9.5.2

- :rocket: More robust error handling as a single string/integer could be parsed as valid JSON

### v9.5.1

- :tada: Reintroduce explode module in ES6ify

### v9.5.0

- :tada: Add support for multiple token files

### v9.4.0

- :tada: Add tokens for `de en es fi fr he hk it jp kr nl no pt se` lang codes

### v9.3.4

- :bug: `feat` scope

### v9.3.3

- :bug: Error could lead to null feat

### v9.3.2

- :rocket: Add error handling for GeoJSON parsing - dump errors to tmp file

### v9.3.1

- :rocket: Calculate centre&ID for non-assigned addresses
- :bug: double nest non-assigned addresses

### v9.3.0

- :rocket: Support for unit numbers in final output

### v9.2.0

- :rocket: Output orphaned Addresses (Those not matched with the network) as their own clustered `GeometryCollection`

### v9.1.0

- :rocket: Concat multiple Point/LineString geoms into a single Multi within the geometry for simplicity

### v9.0.1

- :bug: Fix validity of output GeometryCollection when Addresses are not matched

### v9.0.1

- :bug: Fix validity of output GeometryCollection

### v9.0.0

- :rocket: Output final geometry as a Carmen Compatible GeometryCollection that contains both the network and the component addresses that went into making the interpolation.

### v8.1.1

- :bug: fix edge case where strip-unit map could hard fail

### v8.1.0

- :tada: add `strip-unit` map for ensuring all house numbers are integers

### v8.0.1

- :bug: maps appended `__dirname` twice

### v8.0.0

- :rocket: `--tokens` flag now just takes a single country code instead of a path ie: `--tokens en`
- :rocket: `--map-network`,`--map-address` flag now just takes a single module name instead of a path ie: `--map-network minjur`

### v7.2.2

- :tada: Add pt2itp bin command for global installs

### v7.2.1

- :bug: Add replacement token so comma removal wouldn't add `undefined` string.

### v7.2.0

- :rocket: The purity of freq has been restored! It only accepts a single text array instead of an address/network array to concat.
- :rocket: Pre-calculate cluster.match buffer value to force postgres to use GIST indexes

### v7.1.0

- :tada: `test` mode now bases pass/fail on distance
- :tada: `test` mode now uses carmen `proximity` option when coordinates are given

### v7.0.0

- :tada: Numbers are cheap eh?
- Rewrite `test` mode to work on an entire index instead of indexing on the fly in memory for a single vector tile as this isn't possbile anymore
- Rewite Map Mode with a lot of thought going towards optimizing queries and rewriting where possible. Singapore is 114x faster on 7.0 from 6.0

### v6.0.0

- :rocket: Update to Node 6.x.x
- :arrow_up: Update all deps to latest versions

### v5.1.0

- :bug: Rework internals to never defer an entire id stack to avoid callback overflow on large sources

### v5.0.2

- :bug: path.join => path.resolve to go to correct geojson file in --network/--address path

### v5.0.1

- :bug: tile-cover and tilebelt are still needed for zxy calc

### v5.0.0

- :rocket: Huge rewrite of backend to move from vector tiles to postgres backed data processing
- :rocket: Input data is now raw geojson (line delimited). This is the same geojson that would have been fed into
            tippecanoe so it should be a relatively minor change cli wise.
- :rocket: add `--map-network` & `--map-address` options to have sparate map files for diffing input types.
- :pencil2: Dropped `util` mode which did tile calculations
- :pencil2: Dropped `name` mode. Now done automatically

### v4.2.1

- :bug: Remove unnecessary tile.toGeoJSON which caused a fatal error on empty tiles

### v4.2.0

- :tada: Added `fr` language tokens and README to `lib/tokens/`

### v4.1.0

- :tada: Add single query mode to `test` mode (--query param)

### v4.0.6

- :rocket: Dedupe `test` module output for easier debugging

### v4.0.5

- :bug: new mapnik version was causing install issues - downgraded to mapnik@3.5.13 until they can be resolved
- :arrow_up: upgrade turf modules to new `@turf` prefix where possible.

### v4.0.4

- :arrow_up: eslint@3.7.1, mapnik@3.5.14, & carmen@17.0.0

### v4.0.3

- :bug: Fix percent calculation for `test` mode
- :rocket: Throw hard error if `--map` option does not point to a valid map function

### v4.0.2

- :bug: Apple can rot in hell for having a case insensitive file system (Also BSD grep is aweful)

### v4.0.1

- :pencil2: Update README with `-b 0` on tippecanoe commands to ensure vector tiles aren't buffered (this can cause overlap and strange results)

### v4.0.0

- :tada: Add `test` mode which runs the original raw addresses against the generated ITP lines (using carmen) to ensure complete coverage.
- :rocket: Address number must now be a valid Integer. (Precents unit numbers from creating bad results)

### v3.2.0

- :white_check_mark: Add final buffer test to complete test coverage
- :rocket: explode no longer drops circular ways if they are named

### v3.1.1

- :arrow_up: d3-queue@3.0.3
- :arrow_up: eslint@3.3.1

### v3.1.0

- :white_check_mark: add a bunch of tests for addresses that fall off the end of a LineString
- :tada: Addresses that fall off the end of a linestring are now ordered differently than addresses on a LineString for more accurate matching.

### v3.0.2

- :pencil2: Remove ENV vars from README
- :pencil2: Update help documentation

### v3.0.1
- :arrow_up: eslint@3.1.1

### v3.0.0
- :rocket: `[lr]parity` => `parity[lr]` as per the carmen spec

### v2.10.1
- :bug: Fix hard error on debug output when r/l start/end is autoincremented due to differing parity

### v2.10.0
- :tada: parity is now assigned any time there is a valid start/end address
- :tada: if only start/end is assigned then end/start is made to equal it

### v2.9.1
- :arrow_up: `eslint@3.0.1`
- :arrow_up: `turf@3.0.14`

### v2.9.0
- :white_check_mark: Add a ton of more tests to explode functions
- :tada: Explode will not join if the resultant geometry self intersects (Less mixed odd/even addresses)
- :tada: Explode will not join if angle of join is > 45deg (default - configurable) (Fixes dual carriageways)
- :tada: Explode will has default max line length of 1 segment over 1km. (More accurate ITP segments)

### v2.8.2
- :bug: `cluster#clusterCluster` now sorts internally
- :bug: `cluster#closestCluster` doesn't include empty arrays of streets outside the buffer
- :white_check_mark: Add basic `cluster#closestCluster` test to make sure nothing breaks

### v2.8.1
- :arrow_up: d3-queue@3.0.1
- :arrow_up: eslint@2.13.1

### v2.8.0
- :tada: qa-tiles map now emits string for single name or array for multiple street names (alternates)
- :rocket: :white_check_mark: generalize `name#tokenizeFeats` and `worker#tokenizeFeats` to single `tokenize#perFeats` & add tests
- :tada: :white_check_mark: `tokenize#perFeats` now handles alternate names by creating duplicate geometries with each name and a list of alternates for each + add tests
- :tada: `interpolize` now adds alterate array to `carmen:text` (comma delimited)

### v2.7.1
- :tada: Allow `unclassified` highway type in qa-tiles map
- :bug: Explode streets after autoname function to ensure they are clustered properly

### v2.7.0
- :tada: Add streaming input/output option to `convert` module.
- :tada: `--input` and `--output` are now optional - falling back to stdout and stdin

### v2.6.0
- :tada: Add `--name` flag to `map` mode which will attempt to autoname roads
- :tada: Make `name` mode use generic closestCluster to share with `map` mode
- :tada: :white_check_mark: Add road side buffering module and tests

### v2.5.3
- :bug: Parse integers from --xy as internal functions expect integers

### v2.5.2
- :white_check_mark: Add split test

### v2.5.1
- :white_check_mark: Add expansive tests to bring coverage from ~50% to ~85%
- :tada: Change debug output slightly to be able to better generate unit tests

### v2.5.0

- Add name mode which will dump unnamed streets, when combined with the --debug flag it will also include the 2 address clusters which have the highest probability of having the correct street name.
- Add --raw <TYPE> mode which allows dumping of address data in a given tile (works for map and name mode ToDo allow streets & \*)
- Add plurals as aliases so I have to check my own docs less

### v2.4.2

- Retain `carmen:text` field in cluster module

### v2.4.1

- Fix bug in explode.js where explode would silently drop a LineString if it was the last unconnected LineString in a MultiLineString.

### v2.4.0

- Add --zoom option to specify non-standard zoom
- Add --xy & --coords options to only process a single tile for debug work

### v2.3.0

- Use centroid verification to ensure calculated centroid is within tile
- Fall back from point-on-surface to centre of z14 tile

### v2.2.2

- Use centre coord to avoid being rejected by carmen's verify centroid

### v2.2.1

- Use first coord in linestring as carmen:center to avoid miscalculated centroids

### v2.2.0

- Add --map function which allows non-standard vector tiles to be mapped into the address/street standard defined in the readme
- Add demo qa-tiles mapper function

### v2.1.1

- Pin mapnik version to allow binary installation (3.5.13)

### v2.1.0

- Allow zooms other than 14.

### v2.0.0

- Output in carmen range format for easy indexing
- convert command now works with line delimited Features or FeatureCollections
- Support non-continuous streets and divide addresses between them
