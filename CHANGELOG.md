# CHANGELOG

## Emoji Cheatsheet
- :pencil2: doc updates
- :bug: when fixing a bug
- :rocket: when making general improvements
- :white_check_mark: when adding tests
- :arrow_up: when upgrading dependencies
- :tada: when adding new features

## Version History

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
