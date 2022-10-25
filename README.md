# OpenAPI Down Convert

`openapi-down-convert` is a tool to down-convert an API definition document from OpenAPI 3.1 to OpenAPI 3.0.

* [OpenAPI Specification (OAS) 3.1.0 Release](https://github.com/OAI/OpenAPI-Specification/releases/tag/3.1.0)
describes the changes from OAS 3.0 to OAS 3.1.
* See
[Migrating from OpenAPI 3.0 to 3.1.0](https://www.openapis.org/blog/2021/02/16/migrating-from-openapi-3-0-to-3-1-0)
for going in the other direction. This tool helps "undo" those transformations.

**Warning**: This is not a fully robust tool. It does the minimal work necessary for Apiture OAS 3.1 API documents in order to support tools such as `openapi-generator` which do not support OAS 3.1. It only supports the
OAS 3.1 features that the Apiture APIs use.

## Installation and Synopsis

The tool is implemented with Node.js.
### &DownArrowBar; NPM Installation

```bash
npm i @apiture/openapi-down-convert
```

```typescript
import { Converter, ConverterOptions } from './converter';
const options : ConverterOptions = { verbose: false, deleteExampleWithId: true, allOfTransform: false };
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
$ npm i -g @apiture/openapi-down-convert
```

then to use:

```bash
$ openapi-down-convert --input openapi-3.1.yaml --output openapi-3.0.yaml
```

Command line options:

```text
  -V, --version                  output the version number
  -i, --input <input-file>       A OpenAPI 3.1 file name. Defaults to "openapi.yaml"
  -o, --output <output-file>     The output file, defaults to stdout if omitted
  -a, --allOf                    If set, convert complex $ref in JSON schemas to allOf
  -d, --delete-examples-with-id  If set, delete any JSON Schema examples that have an `id` property
  -v, --verbose                  Verbose output
  -h, --help                     display help for command
```

The verbose mode logs the changes to standard error output stream.

The tool only supports local file-based documents, not URLs
Download such files to convert:

```bash
openapi-down-convert --input <(curl -s https://my.host/path/openapi-3.1.yaml) --output openapi-3.0.yaml
```

## OpenAPI Specifications Transformations

Here is a list of the transformations the tool performs:

### &DownArrowBar; openapi declaration

Change `openapi: 3.1.x` to `openapi: 3.0.3`

### &DownArrowBar; `openIdConnect` security definitions

Replace `openIdConnect` security definition with an `oauth2` security requirement - they are close enough, as far as code generation (such as `openapi-generator`) is concerned - it just means an `Authorization: header` must have a valid token. Use the options
to specify the `authorizationUrl` and `tokenUrl` for the
`oauth2` security definition.

TODO: Fetch the openIdConnect connection info and extract the authorization and token URLs from it.

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
        <Insert the names/definitions of the scopes from all the
        operations that use `accessToken`. Must generate descriptions
        for each, such as

        banking/read: Read access to accounts and account-related resources such as
          transfers and transactions.
        banking/write: Write (update) access to accounts and account-related resources
          such as transfers and transactions.
        banking/delete: Delete access to deletable accounts and account-related
          resources such as transfers.
        banking/readBalance: Read access to account balances. This must be granted in
          addition to the `apiture/readBanking` scope in order to view
          balances, but is included in the `banking/full` scope.
        banking/full: Full access to accounts and account-related resources such as
          transfers and transactions.
        >
```

### &DownArrowBar; `$ref` object rewrites

For all schemas which contain a `$ref` object with siblings (`description`, other schema elements), replace the `$ref`: uri with `allOf` . For example:

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

**Note** This transformation is disabled; it breaks `openapi-generator` 5.4 in cases where the
referenced schema is an array.
It generates Typescript types for such as

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

Other (non-JSON Schema) OAS 3.1 `$ref` objects can have `description` and `summary`. `$ref`
for non-schema objects in OAS 3.0 cannot have `description` and
`summary`. `openapi-down-convert` simply removes `description` and
`summary` to yield a valid [JSON reference](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03) as required by OAS 3.0. (The resulting OpenAPI will use the `description` in the `$ref` target.)


### &DownArrowBar; `info.license`

Remove the `info.license` and just retain the `info.termsOfService`


### &DownArrowBar; JSON Schema related changes

OAS 3.0 uses an earlier JSON Schema version (Draft 7). The tool convert `examples` in schemas
to a single `example`.

As a special case, if the resulting `example` includes an `id`, it is
deleted if the `--delete-examples-with-id` CLI option is set.
This addresses [Spectral issue 2081](https://github.com/stoplightio/spectral/issues/2081).

## Unsupported down conversions

* `openapi-down-convert` does not convert `exclusiveMinimum` and `exclusiveMaximum` as defined in JSON Schema 2012-12; these are not supported in JSON Schema Draft 7 used in OAS 3.0
* Webhooks are not addressed. Contributions welcome!
* The tool only supports self-contained documents. It does not follow or resolve external `$ref` documents embedded in the source document.