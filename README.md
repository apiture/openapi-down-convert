# OpenAPI Down Convert

`openapi-down-convert` is a tool to down-convert an API definition document from
OpenAPI 3.1 to OpenAPI 3.0.

* [OpenAPI Specification (OAS) 3.1.0 Release](https://github.com/OAI/OpenAPI-Specification/releases/tag/3.1.0)
describes the changes from OAS 3.0 to OAS 3.1.
* See
[Migrating from OpenAPI 3.0 to 3.1.0](https://www.openapis.org/blog/2021/02/16/migrating-from-openapi-3-0-to-3-1-0)
for going in the other direction. This tool helps "undo" some of those transformations.

**Warning**: This is not a fully robust tool. It does the minimal work necessary
for OAS 3.1 API documents in order to support tools such as `openapi-generator`
which do not support OAS 3.1. It only supports the OAS 3.1 features that the
Apiture APIs use.

**Warning**: Down converting yields a loss in fidelity. Some API information
is lost.

## Installation and Synopsis

The tool is implemented with Node.js.

### &DownArrowBar; NPM Installation

```bash
npm i @apiture/openapi-down-convert
```

```typescript
import { Converter, ConverterOptions } from './converter';
const options : ConverterOptions = { verbose: false,
                                     deleteExampleWithId: true,
                                     allOfTransform: false };
  const converter = new Converter(oas31Document, options);
  try {
    const oas30Document = converter.convert();
    ...
    }
  } catch (ex) {
    // handle the exception
  }
```

Since the use case for the converter is in build pipelines and CLI use,
this operation is synchronous and does not use `async/await/Promises`.

### &DownArrowBar; Command Line

Install:

```bash
npm i -g @apiture/openapi-down-convert
```

then to use:

```bash
openapi-down-convert --input openapi-3.1.yaml --output openapi-3.0.yaml
```

Command line options:

```text
Usage: openapi-down-convert [options]

Options:
  -i, --input <input-file>               A OpenAPI 3.1 file name. Defaults to "openapi.yaml"
  -o, --output <output-file>             The output file, defaults to stdout if omitted
  -a, --allOf                            If set, convert complex $ref in JSON schemas to allOf
  --authorizationUrl <authorizationUrl>  The authorizationUrl for openIdConnect -> oauth2 transformation
  --tokenUrl <tokenUrl>                  The tokenUrl for openIdConnect -> oauth2 transformation
  -d, --delete-examples-with-id          If set, delete any JSON Schema examples that have an `id` property
  --oidc-to-oath2 <scopes>               Convert openIdConnect security to oath2.
  -s, --scopes <scopes>                  If set, this JSON/YAML file describes the OpenID scopes.
                                         This is an alias for --oidc-to-oath2
  -v, --verbose                          Verbose output
  -V, --version                          output the version number
  -h, --help                             display help for command
```

The verbose mode logs the changes to standard error output stream.

The tool only supports local file-based documents, not URLs.
Download such files to convert:

```bash
openapi-down-convert --input <(curl -s https://my.host/path/openapi-3.1.yaml) \
                     --output openapi-3.0.yaml
```

## OpenAPI Specifications Transformations

Here is a list of the transformations the tool performs:

### &DownArrowBar; openapi declaration

Change `openapi: 3.1.x` to `openapi: 3.0.3`

### &DownArrowBar; `openIdConnect` security definitions

Replace `openIdConnect` security definition with an `oauth2` security requirement
They are close enough, as far as code generation (such as `openapi-generator`)
is concerned - it just means an `Authorization: header` must have a valid token.

Note: This conversion is only performed if the `--oidc-to-oauth2` option
(or it's alias, `--scopes`) is supplied.
Use the other options to specify the `authorizationUrl` and `tokenUrl` for the
`oauth2` security definition.

TODO: Fetch the openIdConnect connection info and extract the authorization and
token URLs from it.

```yaml
    accessToken:
      type: openIdConnect
      description: ...
      openIdConnectUrl: 'https://auth.apiture.com/openidConnectDiscovery'
```

becomes something like:

```yaml
accessToken:
  type: oauth2
  description: "OpenIDConnect authorization code flow via https://auth.apiture.com/openidConnectDiscovery"
  flows:
    authorizationCode:
      authorizationUrl: <authorizationUrl option>
      tokenUrl: <tokenUrl option>
      scopes:
        scope1: Allow the application to access your personal profile data.
        scope2: Allow the application to send email on your behalf.
        scope3: >-
          TODO: describe the 'scope3' scope.
        scope4: >-
          TODO: describe the 'scope4' scope.
```

The tool scans all the `security` objects in all the operations to build
a list of the used scopes. The descriptions for the scopes should be
be supplied in the `scopes.yaml`file as simple `scopeName: scope description`
pairs:

```yaml
scope1: Allow the application to access your personal profile data.
scope2: Allow the application to send email on your behalf.
```

### &DownArrowBar; `$ref` object rewrites

For all schemas which contain a `$ref` object with siblings (`description`, other
schema elements), replace the `$ref`: uri with `allOf` . For example:

```yaml
myProperty:
  description: Blah blah
  $ref: '#/components/schemas/MyArray'
```

becomes:

```yaml
mySchema:
  description: Blah blah
  allOf:
    - $ref: '#/components/schemas/MyArray'
```

This also applies to the schema used in parameters or in `requestBody` objects
and in responses.

**Note** This transformation is disabled by default because it breaks `openapi-generator` 5.4 in
cases where the referenced schema is an array.
It generates Typescript types for such cases as

```typescript
  myProperty: Array | null;
model/Model.ts:26:23 - error TS2314: Generic type 'Array<T>' requires 1 type argument(s).
```

which should be

```typescript
  incompleteAccounts: Array<string> | null;
```

To enable, use the `allOfTransform: true` option in the `Converter` constructor
or the `--allOf` command line argument. When disabled, the `$ref` is instead
simplified to a [JSON reference](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03).

Other (non-JSON Schema) OAS 3.1 `$ref` objects can have `description` and `summary`.
`$ref` for non-schema objects in OAS 3.0 cannot have `description` and
`summary`. `openapi-down-convert` simply removes `description` and
`summary` to yield a valid [JSON reference](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03)
as required by OAS 3.0. (The resulting OpenAPI will use the `description`
in the `$ref` target.)

### &DownArrowBar; `info.license.identifier`

Remove `info.license.identifier`.

### &DownArrowBar; JSON Schema related changes

OAS 3.0 uses an earlier JSON Schema version (Draft 4). The tool convert `examples`
in schemas
to a single `example`.

As a special case, if the resulting `example` includes an `id`, it is
deleted if the `--delete-examples-with-id` CLI option is set.
This addresses [Spectral issue 2081](https://github.com/stoplightio/spectral/issues/2081).

### &DownArrowBar; Convert `const` to `enum`

Convert JSON Schema that uses `const` to an `enum` with one value. For example

```yaml
components:
  schema:
     version:
        description: The API version.
        type: string
        const: '1.0.0'
```

 becomes

```yaml
components:
  schema:
     version:
        description: The API version.
        type: string
        enum:
          - '1.0.0'
```

### Convert type arrays to nullable

If a schema has a type array of exactly two values, and one of them
is the string `'null'`, the type is converted to the non-null string item,
and `nullable: true` added to the schema.

For example:

```yaml
    myResponse:
      title: My Response
      description: Response from an API operation
      type: [ object, 'null' ]
      allOf:
        ...
```

becomes

```yaml
    myResponse:
      title: My Response
      description: Response from an API operation
      type: object
      nullable: true
      allOf:
        ...
```

and

```yaml
    myResponse:
      title: My Response
      description: Response from an API operation
      type: array
      items:
        type: [ 'string', 'null' ]
        ...
```

becomes

```yaml
    myResponse:
      title: My Response
      description: Response from an API operation
      type: array
      items:
        type: string
        nullable: true
        ...
```

This transformation does not handle more complex `type` array
scenarios such as

```yaml
   type: [ number, string, boolean, 'null']
```

To support that, the schema would need to be recast using `oneOf`,
but this is not trivial due to other schema attributes that may
be possible (`properties`, `allOf` etc.)

(Contributions welcome.)

### Remove `unevaluatedProperties`

The tool removes the `unevaluatedProperties` value, introduced in later
versions of JSON Schema,
as this is not supported in OAS 3.0 JSON Schema Draft 4
used in OAS 3.0.

```yaml
    myResponse:
      title: My Response
      description: Response from an API operation
      type: object
      unevaluatedProperties: false
      allOf:
        ...
```

becomes

```yaml
    myResponse:
      title: My Response
      description: Response from an API operation
      type: object
      unevaluatedProperties: false
      allOf:
        ...
```

### Remove schema `$id` and `$schema`

The tool removes any `$id` or `$schema` keywords that may appear
inside schema objects.

## Unsupported down conversions

* `openapi-down-convert` does not convert `exclusiveMinimum` and `exclusiveMaximum`
as defined in JSON Schema 2012-12; these handled differently in JSON Schema Draft 4
used in OAS 3.0. Contributions welcome!
* Webhooks are not addressed. Contributions welcome!
* The tool only supports self-contained documents. It does not follow or resolve
external `$ref` documents embedded in the source document.
