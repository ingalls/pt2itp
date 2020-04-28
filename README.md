<h1 align="center">PT2ITP</h1>

<p align="center">Given a road network and a set of address points as line delimited geojson; output an interpolation network.</p>

<p align="center">
  <a href="https://coveralls.io/github/ingalls/pt2itp?branch=master"><img src="https://coveralls.io/repos/github/ingalls/pt2itp/badge.svg?branch=master"/></a>
  <a href="https://circleci.com/gh/ingalls/pt2itp/tree/master"><img src="https://circleci.com/gh/ingalls/pt2itp/tree/master.svg?style=shield"/></a>
  <a href="https://david-dm.org/ingalls/pt2itp"><img src="https://david-dm.org/ingalls/pt2itp.svg"/></a>
  <a href="https://david-dm.org/ingalls/pt2itp?type=dev"><img src="https://david-dm.org/ingalls/pt2itp/dev-status.svg"/></a>
  <a href="https://greenkeeper.io/"><img src="https://badges.greenkeeper.io/ingalls/pt2itp.svg"/></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/pt2itp"><img src="https://nodei.co/npm/pt2itp.png?downloads=true&downloadRank=true"/></a>
</p>

## `map` Mode

### Basic Usage

`map` mode is the core mode that PT2ITP exposes. It is responsible for taking the input street network and address points
and generating the interpolation network.

Basic Usage:
```
./index.js map --in-network=<FILE.geojson> --in-address=<File.geojson> --output=<File.geojson> --languages=en --db <DB>
```

Full Options:
```
./index.js map --help
```

### Input Data

#### Address Input

Input line-delimited geojson features of points. Each point should have a property called `street` containing the street name
and `number` containing the street address.

Addresses can have any number of name synonyms of equal or differing priority.

#### Properties

| Property | Function |
| :------: | -------- |
| `number` | `String` The Housenumber for a given pt including any unit information. ie: `10a` |
| `street` | `String` or `Array` The name of the street - preferably non-abbreviated. If it's an array, it must contain an object for each street name synonym with the properties `display` for the street name and `priority` for the numeric ranking. |
| `source` | `String` The source name of the data so a single input file can have a combination of multiple sources |
| `output` | `Boolean` A boolean allowing pts to be used to calculate the ITP segment but not output in the final cluster |

##### Example

```
{ "type": "Feature", "geometry": { "type": "Point", ... }, "properties": { "street": "Main Street", "number": 10 } }
{ "type": "Feature", "geometry": { "type": "Point", ... }, "properties": { "street": [ { display: "Main Street", priority: 0  } ], "number": 11 } }
...
```

#### Street Network Input

Input line-delimited geojson features of lines. Each line should have a property called `street` containing the street name.

**Note**: Networks can have any number of name synonyms but must have one name feature that has a priority level higher than the other synonyms.

##### Example

```
{ "type": "Feature", "geometry": { "type": "LineString", ... }, "properties": { "street": "Main Street" } }
{ "type": "Feature", "geometry": { "type": "LineString", ... }, "properties": { "street": "Main Street" } }
...
```

## `conflate` Mode

### Basic Usage

CONFLATE MODE

Basic Usage:
```
./index.js conflate --in-address=<FILE.geojson> --in-persistent=<File.geojson> --output=<File.geojson> --tokens=en --db <DB>
```

Full Options:
```
./index.js conflate --help
```

### Input Data

#### Persistent Address Input

CONFLATE MODE PERSISTENT ADDRESS

#### Properties

| Property | Function |
| :------: | -------- |
| `` | ``

##### Example

```
```

#### Conflate Address Input

##### Example

```
...
```

### Output Format


## `convert` Mode

### Basic Usage

Converts the PT2ITP standard of line delimited geojson features into the more widely
supported GeoJSON FeatureCollections. Note that since GeoJSON is a text based format
this should not be used for huge numbers of features as most parsing software will
run out of memory.

Basic Usage:
```
./index.js convert --input linedelimited.geojson --output featurecollection.geojson
```

Full Options:
```
./index.js convert --help
```

## `analyze` Mode

### Basic Usage

Analyzes the name field of a set of address and network data from either the database or a GeoJSON file. Outputs a CSV and markdown summary of the frequency distribution of each token in the data. Also includes a comparison mode for comparing address and network tokens.

Basic Usage:
```
./index.js analyze --cc us_ia --type address --output=/tmp/us_ia.text-analysis/address
```

## `consensus` Mode

### Basic Usage

Takes in multiple sets of address points, links addresses together using a set of query points, and calculates agreement metrics for each set of linked addresses.

Basic Usage:
```
./index.js consensus linedelimited1.geojson linedelimited2.geojson linedelimited3.geojson --query_points linedelimited.geojson --db consensus --languages en --country us
```

Full Options:
```
./index.js consensus --help
```

## Version Numbers

PT2ITP follows the [Semver](http://semver.org/) spec for it's **CLI interface**.

This means that breaking changes to the CLI tools will result in a `MAJOR` release.
New features will result in a `MINOR` release and bug fixes a `PATCH`.

Internal functions may change in breaking ways with a `MINOR` release so long as they
don't change/break the CLI interface.

## Terminology

### Parts of an Address

```
123 1/2 West 1st Street
┬── ┬── ┬─── ┬┬─ ┬
│   │   │    ││  └┤ Suffix, Street Type - The type of street, ie: highway, street, circle.
│   │   │    ││   │ rules for suffixes will differ per county/municipality
│   │   │    ││
│   │   │    │└┤ Ordinal Indicator - The group of characters, following a numeral denoting that it is an ordinal number
│   │   │    │
│   │   │    └┤ Ordinal - The numberic portional of a street name - must be followed by an ordinal indicator
│   │   │
│   │   └┤ Precardinal, predirectional - The compass direction preceeding the street name
│   │
│   └┤ Fractional Address
│
└┤ Primary Address Number



289-1 Main Street Northeast APT 4
┬────             ┬──────── ┬── ┬
│                 │         │   └┤ Secondary Address
│                 │         │
│                 │         └┤ Secondary Address Address Designator
│                 │          │ Common types include Apartment=APT, Building=BLDG
│                 │          │ Floor=FL, Suite=STE, Unit, ROOM=RM, Department=Dept
│                 │          │ the # sign can be used if the specific type is not covered
│                 │
│                 └┤ postcardinal, postdirectional
│
└┤ Hypenated Primary Address Number - The hyphen is significant and should not be omitted.
 │ Different hyphenated standards represent different things. wikipedia: Queens Addresses
```
