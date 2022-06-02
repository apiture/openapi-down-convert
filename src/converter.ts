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

  refVisitor: RefVisitor = (node: RefObject): JsonNode => {
    if (Object.keys(node).length === 1) {
      return node;
    } else {
      node['allOf'] = [{ $ref: node.$ref }];
      delete node.$ref;
      return node;
    }
  };

  public convert(): object {
    this.log('Converting from OpenAPI 3.1 to 3.0');
    this.openapi30.openapi = '3.0.3';
    this.convertSchemaRef();
    return this.openapi30;
  }

  /**
   * In a JSON Schema, replace `{ blah blah, $ref: "uri"}`
   * with `{ blah blah, allOf: [ $ref: "uri" ]}`
   * @param object an object that may contain JSON schemas (directly
   * or in sub-objects)
   */
  private simplifyRefObjectsInSchemas(object: object) {
    visitRefObjects(object, this.refVisitor);
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
