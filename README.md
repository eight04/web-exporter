web-exporter
===========

![Github Build](https://github.com/eight04/web-exporter/workflows/.github/workflows/build.yml/badge.svg)

A webextension inspired by twitter-web-exporter. It allows you to export data, media from websites.

* Use webRequest API so it is more reliable. But it doesn't support Chrome (yet).
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
    type: <exporter_type> # required, the type of exporter. Can be `media`, `url`
    steps:         # required, list of steps to export data
      - use: <step_name>
        [param1]: <value1>
        [param2]: <value2>
        ...
```

Steps
-----

Both extractors and exporters are composed of multiple steps.

Each step that transforms data can have an optional `input` and `output` field to control data flow. By default, the output of the previous step is used as input, and the output of the current step is passed to the next step. If `input` is specified, the field in the data context will be used as input instead. If `output` is specified, the output of the current step will be stored in that field in the data context.

When specifying a JSON path, you can use dot notation and array indices. For example, `posts[0].user.name` refers to the `name` field of the `user` object in the first item of the `posts` array.

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

`table` - required, the database table name to store the data.

`method` - required, the storage method. Can be `put`, `putMany`, `getAll`. Currently `put` is implemented as `add` so users will get an error if the key already exists. This should make it easier to spot duplicated entries while recording.

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

### if

Conditionally execute steps based on a condition.

`condition` - required. It can be string or an object.

```ts
type Condition =
  | string // the name of a builtin condition function. If not found, it will be treated as a regular expression to match the input data.
  | {
      [key: string]: Condition; // each key must satisfy the corresponding condition
    }
```

`steps` - required, an array of steps to execute if the condition is true.

### elif

Similar to `if`, but used after an `if` or another `elif` step. The steps will be executed only if the previous `if`/`elif` conditions are false, and the current condition is true.

`condition` - required. See `if` step for details.

`steps` - required, an array of steps to execute if the condition is true.

### else

Used after an `if` or `elif` step. The steps will be executed only if all previous conditions are false.

`steps` - required, an array of steps to execute.

### for_each

Iterate over each item in the input array, and execute a list of steps for each item as data.

`condition` - optional. See `if` step for details. The condition is evaluated for each item, and the steps are only executed if the condition is true.

`ref` - optional, the name of the variable to store the current item. If not specified, the current item will be used as input data for substeps. If specified, the item will get an additional property `index` representing the count of executions starting from 0.

`steps` - required, an array of steps to execute for each item.

### date

Convert the input data to a date object. Usually used with `input`, `output` to convert a specific field.

### filter

Filter the input array by a condition.

`condition` - required. See `if` step for details. The condition is evaluated for each item, and only items that satisfy the condition are kept.

### export

Export input URLs. Usually you want to set a `filename` for media exporters but not for URL exporters.

`filename` - optional, a python template string to name the file. The input data will be used as the context for the template, therefore you should always specify `input` field for URLs when using this step. Besides the fields in the data context, the following special variables are also available:
  - `index`: the index of the current item in the input array, starting from 0.
  - `ext`: the file extension extracted from the URL.
  - `filename`: the name of the file extracted from the URL.

`input` - *required if filename is set*, the field in the data context that contains the URL to export. The value of the field can be string or array of strings.

### find

Find an item in the input array with the maximum/minimum value of a specified field.

`key` - required, the field name to compare.

`mode` - required, can be `max` or `min`.

### flat

Flatten the input array of arrays into a single array.

`depth` - optional, the depth to flatten. Default is infinity.

### debug

Log the input data to the console for debugging purposes.

`message` - optional, a message to display.

### const

Set a constant value as output.

`value` - required, the constant value.

### spider_refresh

Refresh the page or navigate to a specified URL.

`url` - optional, the URL to navigate to. If not specified, the current page will be refreshed.

### spider_click

Click an element on the page.

`selector` - required, a CSS selector to find the element to click. You can use the `else` step to handle the case when the element is not found.

### wait

Wait for a specified event.

`extractor` - the name of the extractor to wait for.

### loop

Repeat a set of steps until loop_break step is called.

`steps` - required, an array of steps to execute in each iteration.

### loop_break

Break the current loop.

Todos
-----

* Add `spiders` to click links or scroll pages automatically to load more data?
* Add XHR, fetch mock so the extension can work on Chrome?
* Make yml editable in the extension UI?

Changelog
---------

* Next

  - Add: export twitter spaces URLs.
  - Change: rename step `download` to `export`.
  - Change: add `type` field to exporter.

* 0.2.0 (Nov 17, 2025)
  
  - Add: condition to for_each step.
  - Add: const step.
  - Add: debug step.
  - Add: find step.
  - Add: flat step.
  - Add: if, elif, else steps.
  - Add: now all steps support member and index access with json path.
  - Add: twitter.
  - Change: changed how condition works. Rename builtin conditions. Now regex condition don't start with RX_ anymore.
  - Change: if the step doesn't output anything, the next step won't receive undefined anymore.
  - Fix: can't use `$&` in re step template.
  - Fix: cleanup file extension like `.jpg:large` when downloading.

* 0.1.1 (Nov 8, 2025)

  - Fix: add URLPattern polyfill for Firefox.

* 0.1.0 (Nov 7, 2025)

  - First release.
