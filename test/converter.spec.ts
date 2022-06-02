/* eslint-disable prefer-destructuring */
// import * as fs from 'fs';
// import * as path from 'path';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, test, xit } from '@jest/globals';
// import * as yaml from 'js-yaml';

import { Converter } from '../src/converter';

describe('resolver test suite', () => {
  test('Convert changes openapi: 3.1.x to 3.0.x', (done) => {
    // const sourceFileName = path.join(__dirname, 'data/root.yaml'); // __dirname is the test dir
    const input = {
      openapi: '3.1.0',
    };
    const converter = new Converter(input);
    const converted: any = converter.convert();
    expect(converted.openapi).toEqual('3.0.3');
    done();
  });
  xit('Convert changes $ref object to allOf', (done) => {
    // const sourceFileName = path.join(__dirname, 'data/root.yaml'); // __dirname is the test dir
    const input = {
      components: {
        schemas: {
          a: {
            type: 'string',
          },
          b: {
            description: 'a B string based on components/schemas/a',
            title: 'a B string',
            $ref: '#/components/schemas/a',
          },
        },
      },
    };
    const converter = new Converter(input);
    const converted: any = converter.convert();
    const b = converted.components.schemas.b;
    expect(b.$ref).toBeUndefined();
    const allOf = b.allOf();
    expect(allOf).toBeDefined();
    expect(allOf[0]).toEqual('#/components/schemas/a');
    done();
  });

  xit('Disabled test stub, so we can leave xit in the imports and use when needed', (done) => {
    done();
  });
});
