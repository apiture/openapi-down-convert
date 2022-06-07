import * as v8 from 'v8';

import { visitRefObjects, walkObject, RefVisitor, JsonNode, RefObject } from './RefVisitor';

interface OpenAPI3 {
  openapi: string;
  info: object;
  paths: object;
  components: object;
  tags: object;
}

export class Converter {
  private openapi30: OpenAPI3;
  private verbose = false;

  constructor(openapiDocument: object, verbose = false) {
    this.openapi30 = Converter.deepClone(openapiDocument) as OpenAPI3;
    this.verbose = verbose;
  }

  private log(...message) {
    if (this.verbose) {
      console.warn(...message);
    }
  }
  private warn(...message) {
    message[0] = `Warning: ${message[0]}`;
    console.warn(...message);
  }

  jsonSchemaRefVisitor: RefVisitor = (node: RefObject): JsonNode => {
    if (Object.keys(node).length === 1) {
      return node;
    } else {
      node['allOf'] = [{ $ref: node.$ref }];
      delete node.$ref;
      return node;
    }
  };

  jsonReferenceVisitor: RefVisitor = (node: RefObject): JsonNode => {
    if (Object.keys(node).length === 1) {
      return node;
    } else {
      this.warn(`Down convert reference object to JSON Reference:\n${JSON.stringify(node, null, 3)}`);
      for (const key in node) {
        if (key !== '$ref') {
          delete node[key];
        }
      }
      return node;
    }
  };

  /**
   * Convert the OpenAPI document to 3.0
   * @returns the converted document. The input is not modified.
   */
  public convert(): object {
    this.log('Converting from OpenAPI 3.1 to 3.0');
    this.openapi30.openapi = '3.0.3';
    this.convertSchemaRef();
    this.simplifyNonSchemaRef();
    this.convertSecuritySchemes();
    this.convertJsonSchemaExamples();
    return this.openapi30;
  }

  /**
   * OpenAPI 3.1 uses JSON Schema 2020-12 which allows schema `examples`;
   * OpenAPI 3.0 uses JSON Scheme Draft 7 which only allows `example`.
   * Replace all `examples` with `example`, using `examples[0]`
   */
  convertJsonSchemaExamples() {
    const objectVisitor = (node: object): JsonNode => {
      if (node.hasOwnProperty('examples')) {
        const examples = node['examples'];
        if (Array.isArray(examples)) {
          const first = examples[0];
          node['example'] = first;
          delete node['examples'];
        }
      }
      return node;
    };
    const schemas = this.openapi30?.components?.['schemas'] || {};
    return walkObject(schemas, objectVisitor);
  }

  /**
   * OpenAPI 3.1 defines a new `openIdConnect` security scheme.
   * Down-convert the scheme to `oauth2` / authorization code flow.
   * Collect all the scopes used in any security requirements within
   * operations and add them to the scheme. Also define the
   * URLs to the `authorizationUrl` and `tokenUrl` of `oauth2`.
   */
  convertSecuritySchemes() {
    const schemes = this.openapi30?.components?.['securitySchemes'] || {};
    for (const schemeName in schemes) {
      const scheme = schemes[schemeName];
      const type = scheme.type;
      if (type === 'openIdConnect') {
        scheme.type = 'oauth2';
        const openIdConnectUrl = scheme.openIdConnectUrl;
        scheme.description = `OAuth2 Authorization Code Flow. The client may
          GET the OpenID Connect configuration JSON from \`${openIdConnectUrl}\`
          to get the correct \`authorizationUrl\` and \`tokenUrl\`.`;
        delete scheme.openIdConnectUrl;
        const scopes = this.oauth2Scopes(schemeName);
        scheme.flows = {
          authorizationCode: {
            authorizationUrl: 'https://www.example.com/oath2/authorize',
            tokenUrl: 'https://www.example.com/oath2/token',
            scopes: scopes,
          },
        };
      }
    }
  }

  /**
   * Find remaining OpenAPI 3.0 [Reference Objects](https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.1.0.md#referenceObject)
   * and down convert them to [JSON Reference](https://tools.ietf.org/html/draft-pbryan-zyp-json-ref-03) objects
   * with _only_ a `$ref` property.
   */
  simplifyNonSchemaRef() {
    visitRefObjects(this.openapi30, this.jsonReferenceVisitor);
  }

  oauth2Scopes(schemeName: string): object {
    const scopes = {};
    const paths = this.openapi30?.paths;
    for (const path in paths) {
      for (const op in paths[path]) {
        if (op === 'parameters') {
          continue;
        }
        const operation = paths[path][op];
        const sec = operation?.security as object[];
        sec.forEach((s) => {
          const requirement = s?.[schemeName] as string[];
          if (requirement) {
            requirement.forEach((scope) => {
              scopes[scope] = scope;
            });
          }
        });
      }
    }
    return scopes;
  }

  /**
   * In a JSON Schema, replace `{ blah blah, $ref: "uri"}`
   * with `{ blah blah, allOf: [ $ref: "uri" ]}`
   * @param object an object that may contain JSON schemas (directly
   * or in sub-objects)
   */
  private simplifyRefObjectsInSchemas(object: object) {
    visitRefObjects(object, this.jsonSchemaRefVisitor);
  }

  convertSchemaRef() {
    walkObject(this.openapi30, (o: object): JsonNode => {
      const keys = Object.keys(o);
      if (keys.includes('schema')) {
        this.simplifyRefObjectsInSchemas(o['schema']);
      }
      if (keys.includes('schemas')) {
        this.simplifyRefObjectsInSchemas(o['schemas']);
      }
      return o;
    });
  }

  public static deepClone = (obj: object): object => {
    return v8.deserialize(v8.serialize(obj)); // kinda simple way to clone, but it works...
  };
}
