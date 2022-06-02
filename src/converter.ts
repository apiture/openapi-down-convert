import * as v8 from 'v8';

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

  public convert(): object {
    if (this.verbose) {
      console.warn('Converting from OpenAPI 3.1 to 3.0');
    }
    this.openapi30.openapi = '3.0.3';
    return this.openapi30;
  }

  public static deepClone = (obj: object): object => {
    return v8.deserialize(v8.serialize(obj)); // kinda simple way to clone, but it works...
  };
}
