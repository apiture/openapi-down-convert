import * as v8 from 'v8';

import {
  visitRefObjects,
  visitSchemaObjects,
  RefVisitor,
  JsonNode,
  RefObject,
  SchemaVisitor,
  SchemaObject,
} from './RefVisitor';

interface OpenAPI3 {
  openapi: string;
  info: object;
  paths: object;
  components: object;
  tags: object;
}

export interface ConverterOptions {
  verbose: boolean;
  deleteExampleWithId: boolean;
}

export class Converter {
  private openapi30: OpenAPI3;
  private verbose = false;
  private deleteExampleWithId = false;

  constructor(openapiDocument: object, options?: ConverterOptions) {
    this.openapi30 = Converter.deepClone(openapiDocument) as OpenAPI3;
    this.verbose = options?.verbose;
    this.deleteExampleWithId = options?.deleteExampleWithId;
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
    // this.convertSchemaRef();
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
    const schemaVisitor: SchemaVisitor = (node: SchemaObject): SchemaObject => {
      if (node.hasOwnProperty('examples')) {
        const examples = node['examples'];
        if (Array.isArray(examples) && examples.length > 0) {
          delete node['examples'];
          const first = examples[0];
          if (this.deleteExampleWithId && first != null && typeof first === 'object' && first.hasOwnProperty('id')) {
            this.warn(`Deleted schema example with \`id\` property:\n${this.json(examples)}`);
          } else {
            node['example'] = first;
            this.warn(`Replaces examples with examples[0]. Old examples:\n${this.json(examples)}`);
          }
        }
      }
      return node;
    };
    const schemas = this.openapi30;
    visitSchemaObjects(schemas, schemaVisitor);
  }

  private json(x) {
    return JSON.stringify(x, null, 2);
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
        this.log(`Converting openIdConnect security scheme to oauth2/authorizationCode`);
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

  // This transformation ends up breaking openapi-generator
  // SDK gen (typescript-axios, typescript-angular)
  // so I've removed it.

  // jsonSchemaRefVisitor: RefVisitor = (node: RefObject): JsonNode => {
  //   if (Object.keys(node).length === 1) {
  //     return node;
  //   } else {
  //     this.log(`Converting JSON Schema $ref ${this.json(node)} to allOf: [ $ref ]`);
  //     node['allOf'] = [{ $ref: node.$ref }];
  //     delete node.$ref;
  //     return node;
  //   }
  // };

  // /**
  //  * In a JSON Schema, replace `{ blah blah, $ref: "uri"}`
  //  * with `{ blah blah, allOf: [ $ref: "uri" ]}`
  //  * @param object an object that may contain JSON schemas (directly
  //  * or in sub-objects)
  //  */
  // private simplifyRefObjectsInSchemas(object: object): JsonNode {
  //   return visitRefObjects(object, this.jsonSchemaRefVisitor);
  //   return object;
  // }

  // convertSchemaRef() {
  //   visitSchemaObjects(this.openapi30, (schema: SchemaObject): SchemaObject => {
  //     return this.simplifyRefObjectsInSchemas(schema) as SchemaObject;
  //   });
  // }

  public static deepClone = (obj: object): object => {
    return v8.deserialize(v8.serialize(obj)); // kinda simple way to clone, but it works...
  };
}
