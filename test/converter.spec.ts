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
  test('Convert changes $ref object to allOf', (done) => {
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
    const allOf = b.allOf;
    expect(allOf).toBeDefined();
    expect(allOf[0].$ref).toEqual('#/components/schemas/a');
    done();
  });
  test('Convert changes $ref object to JSON Reference', (done) => {
    // const sourceFileName = path.join(__dirname, 'data/root.yaml'); // __dirname is the test dir
    const input = {
      paths: {
        '/things/{thingId}': {
          get: {
            parameters: [{ description: 'a thing', $ref: '#/components/parameters/thingIdPathParam' }],
          },
        },
        components: {
          parameters: {
            thingIdPathParam: {
              in: 'path',
              type: 'string',
            },
          },
        },
      },
    };
    const converter = new Converter(input);
    const converted: any = converter.convert();
    const getParam0 = converted.paths['/things/{thingId}'].get.parameters[0];
    expect(getParam0.$ref).toBeDefined();
    expect(getParam0.description).toBeUndefined();
    done();
  });
  test('Convert openIdConnect security', (done) => {
    // const sourceFileName = path.join(__dirname, 'data/root.yaml'); // __dirname is the test dir
    const input = {
      paths: {
        '/things/{thingId}': {
          get: {
            security: [
              {
                accessToken1: ['thing/read', 'profile/read'],
                apiKey: [],
              },
              {
                accessToken2: ['foo/read'],
              },
            ],
          },
          put: {
            security: [
              {
                accessToken1: ['thing/write', 'profile/write'],
                apiKey: [],
              },
              {
                accessToken2: ['foo/write'],
              },
            ],
          },
        },
      },
      components: {
        securitySchemes: {
          accessToken1: {
            type: 'openIdConnect',
            description: 'OpenID Connect #1 - Authorization Code Flow',
            openIdConnectUrl: 'https://www.example.com/oidc-1/.well-known/openid-configuration',
          },
          accessToken2: {
            type: 'openIdConnect',
            description: 'OpenID Connect #2 - Authorization Code Flow',
            openIdConnectUrl: 'https://www.example.com/oidc-2/.well-known/openid-configuration',
          },
        },
      },
    };
    const converter = new Converter(input);
    const converted: any = converter.convert();
    {
      const accessToken1 = converted.components.securitySchemes.accessToken1;
      expect(accessToken1).toBeDefined();
      expect(accessToken1.type).toEqual('oauth2');
      expect(accessToken1.description.includes('https://www.example.com/oidc-1/.well-known/openid-configuration'));
      const scopes1 = accessToken1?.flows?.authorizationCode?.scopes;
      expect(scopes1).toBeDefined();
      expect(Object.keys(scopes1).length).toBe(4);
      expect(scopes1['thing/read']).toBeTruthy();
      expect(scopes1['thing/write']).toBeTruthy();
      expect(scopes1['profile/read']).toBeTruthy();
      expect(scopes1['profile/write']).toBeTruthy();
    }
    {
      const accessToken2 = converted.components.securitySchemes.accessToken2;
      expect(accessToken2).toBeDefined();
      expect(accessToken2.type).toEqual('oauth2');
      expect(accessToken2.description.includes('https://www.example.com/oidc-1/.well-known/openid-configuration'));
      const scopes2 = accessToken2?.flows?.authorizationCode?.scopes;
      expect(scopes2).toBeDefined();
      expect(Object.keys(scopes2).length).toBe(2);
      expect(scopes2['foo/read']).toBeTruthy();
      expect(scopes2['foo/write']).toBeTruthy();
    }
    done();
  });

  xit('Disabled test stub, so we can leave xit in the imports and use when needed', (done) => {
    done();
  });
});
