# OpenAPI Down Convert

Tool to convert from OpenAPI 3.1 to OpenAPI 3.0.

* [OAS 3.1.0 Release](https://github.com/OAI/OpenAPI-Specification/releases/tag/3.1.0)
describes the changes from 3.0 to 3.1.
* See
[Migrating from OpenAPI 3.0 to 3.1.0](https://www.openapis.org/blog/2021/02/16/migrating-from-openapi-3-0-to-3-1-0)
for going in the other direction. This tool helps "undo" those transformations.

**Warning**: This is not a fully robust tool. It does the minimal work necessary for Apiture APIs.

Change `openapi: 3.1.x` to `openapi: 3.0.2`

Replace `openIdConnect` security definition with an `oauth2` security requirement - they are close enough, as far as code generation (`openapi-generator`) is concerned - it just means an `Authorization: header` must have a valid token. The main difference between the two is how a client knows how to authenticate in order to use the API, but they will do that from the actual API doc which will still be `openIdConnect`.

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
      authorizationUrl: <insert the `authorize_endpoint` from the `openIdConnectUrl`>
      tokenUrl: <insert the `token_endpoint` from the `openIdConnectUrl`>
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

For all schemas which contain a `$ref` object with siblings (description, other schema elements), replace the `$ref`: uri with allOf . For example:

```yaml
mySchema:
  description: Blah blah
  $ref: uri
```

becomes:

```yaml
mySchema:
  description: Blah blah
  allOf:
    - $ref: uri
```

This also applies to the schema used in parameters or in `requestBody` objects
and in responses.

Other (non-JSON Schema) OpenAPI 3.1 `$ref` objects can have `description` and `summary`. `$ref`
for non-schema objects in OpenAPI 3.0 cannot have `description` and
`summary`. For this converter, we'll simply remove `description` and
`summary`.

OpenAPI 3.1 also uses JSON Scheme 2020-12

Some JSON Schema related changes:

* OpenAPI 3.0 uses an earlier version, so convert `examples` in schema
  to a single example.
* We don't yet use `exclusiveMinimum` and `exclusiveMaximum`

Other changes:

* We don't use `webhooks`
* Remove the `info.license` and just retain the `info.termsOfService`
