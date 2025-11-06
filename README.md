web-exporter
===========

![Github Build](https://github.com/eight04/web-exporter/workflows/.github/workflows/build.yml/badge.svg)

A webextension inspired by twitter-web-exporter. It allows you to export data, media from different websites.

* Use webRequest API for better compatibility. Therefore it doesn't support Chrome.
* Modular design, easy to extend.

Currently it only supports plurk.com.

Add a site
----------

Check `src/sites/*.yml` for examples.

```yml
id: <site_id> # required, unique site id

db:
  - version: <int> # required, database version
    schema:
      [table_name]: <schema_string> # currently we don't actually use any index. Full doc: https://dexie.org/docs/Version/Version.stores()
      ...

extractor:
  [extractor_name]:
    url: <url_pattern> # required, a URLPattern string to match requests
    steps:             # list of steps to extract data
      - use: <step_name>
        [param1]: <value1>
        [param2]: <value2>
        ...

exporter:
  [exporter_name]:
    steps:         # required, list of steps to export data
      - use: <step_name>
        [param1]: <value1>
        [param2]: <value2>
        ...
```

Steps
-----

Extractor and exporter are composed by multiple steps.

Each step that transforms data can have an optional `input` and `output` field to control data flow. By default all steps operates on the same data context. If specified, the step will use the specified field from the data context as its input, and write its output to the specified field in the data context:

### response

Extract the raw response from the webRequest. This only works in an extractor.

`type` - required, the response type. Can be `json`, `text`.

### re

Transform the input data by matching it with a regular expression.

`pattern` - required, regular expression pattern. This can also be the name of default patterns defined in `step-executor.js`.

`flags` - optional, regular expression flags.

`template` - optional, a template string including `$&, $1, $2, ...` to format the match.

`all` - if true, returns all matches as an array. The template will be applied to each match. Default is false.

### json_parse

Parse the input data as JSON.

`unwrap_new_date` - if true, unwraps any `new Date(...)` constructs in the input string before parsing. Default is false.

### json_get

Get a field from the input JSON object.

`path` - required, a dot-separated path to the desired field.

### store

Store the input data to the database, or fetch data from the database as the output. This should be the last step in an extractor, or the first step in an exporter.

`key` - required, the database table name to store the data.
`method` - required, the storage method. Can be `put`, `putMany`, `getAll`. Currently `put` is implemented as `add` so users will get an error if the key already exists. This should make it easier to avoid duplicates.

### table_join

Join multiple tables from the database into a single array of objects. For example to map a `user_id` field from a `posts` table to the corresponding `user_name` from a `users` table.

```yml
# suppose the current data is a list of posts
- use: table_join
  table: users
  left_key: user_id # compare post.user_id to
  right_key: id     # user.id
  fields:
    user_name: name # add user_name field from user.name
```

`table` - required, the database table name to join with.

`left_key` - required, the key in the current data to compare.

`right_key` - required, the key in the joined table to compare.

`fields` - required, a mapping of new field names to field names in the joined table.

### for_each

Iterate over each item in the input array, and execute a list of steps for each item as data.

`steps` - required, an array of steps to execute for each item.

### date

Convert the input data to a date object. Usually used with `input`, `output` to convert a specific field.

### filter

Filter the input array by a condition.

`condition` - required, currently you can only specify a regular expression as `RX_<pattern>` to match the string representation of each item.

### download

Download input URLs.

`filename` - required, a python template string to name the downloaded files. The input data will be used as the context for the template, therefore you should always specify `input` field for URLs when using this step. Besides the fields in the data context, the following special variables are also available:
  - `index`: the index of the current item in the input array, starting from 0.
  - `ext`: the file extension extracted from the URL.
  - `filename`: the name of the file extracted from the URL.

`input` - *required*, the field in the data context that contains the URL to download. The value of the field can be string or array of strings.

Todos
-----

* Add `spiders` to click links or scroll pages automatically to load more data?
* Add XHR, fetch mock so the extension can work on Chrome?

Changelog
---------

* 0.1.0

    - First release.
