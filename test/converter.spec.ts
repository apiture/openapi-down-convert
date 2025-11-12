/*eslint-disable prefer-destructuring */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, expect, test } from '@jest/globals';

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import { Converter, ConverterOptions } from '../src/converter';

describe('resolver test suite', () => {
  test('Convert changes openapi: 3.1.x to 3.0.x', (done) => {
    const input = {
      openapi: '3.1.0',
    };
    const converter = new Converter(input);
    const converted: any = converter.convert();
    expect(converted.openapi).toEqual('3.0.3');
    done();
  });

  test('Convert changes $ref object to allOf', (done) => {
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
    // First test default: allOfTransform = false
    {
      const converter = new Converter(input);
      const converted: any = converter.convert();
      const b = converted.components.schemas.b;
      expect(b.$ref).toBeDefined();
      expect(b.$ref).toEqual('#/components/schemas/a');
      expect(b.title).toEqual('a B string');
      expect(b.description).toEqual('a B string based on components/schemas/a');
    }
    // test with allOfTransform = true
    {
      const converter = new Converter(input, { allOfTransform: true });
      const converted: any = converter.convert();
      const b = converted.components.schemas.b;
      expect(b.$ref).toBeUndefined();
      const allOf = b.allOf;
      expect(allOf).toBeDefined();
      expect(allOf[0].$ref).toEqual('#/components/schemas/a');
    }
    done();
  });

  test('Convert changes $ref object to JSON Reference', (done) => {
    const input = {
      paths: {
        '/things/{thingId}': {
          get: {
            parameters: [
              { description: 'a thing',
                $ref: '#/components/parameters/thingIdPathParam'
              }
            ],
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
    const options: ConverterOptions = {
      authorizationUrl: 'https://www.example.com/test/authorize',
      tokenUrl: 'https://www.example.com/test/token',
      scopeDescriptionFile: path.join(__dirname, 'data/scopes.yaml'),
      convertOpenIdConnectToOAuth2: true
    };
    const converter = new Converter(input, options);
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
      const flow1 = accessToken1.flows.authorizationCode;
      expect(flow1.authorizationUrl).toEqual(options.authorizationUrl);
      expect(flow1.tokenUrl).toEqual(options.tokenUrl);
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
      const flow2 = accessToken2.flows.authorizationCode;
      expect(flow2.authorizationUrl).toEqual(options.authorizationUrl);
      expect(flow2.tokenUrl).toEqual(options.tokenUrl);
    }
    done();
  });

  test('Convert schema examples to example', (done) => {
    const input = {
      components: {
        schemas: {
          a: {
            type: 'string',
            examples: ['foo', 'bar'],
          },
          b: {
            type: 'object',
            properties: {
              c: {
                type: 'string',
                examples: ['a', 'b'],
              },
              d: {
                type: 'object',
                examples: [{ id: 'a', x: 'b' }],
              },
            },
          },
        },
      },
    };
    const converter = new Converter(input, { allOfTransform: true, deleteExampleWithId: true });
    const converted: any = converter.convert();
    {
      const a = converted.components.schemas.a;
      expect(a.examples).toBeUndefined();
      const example = a.example;
      expect(example).toEqual('foo');
    }
    {
      const c = converted.components.schemas.b.properties.c;
      expect(c.examples).toBeUndefined();
      const example = c.example;
      expect(example).toEqual('a');
    }
    {
      const d = converted.components.schemas.b.properties.d;
      expect(d.hasOwnProperty('examples')).toBeFalsy();
      expect(d.hasOwnProperty('example')).toBeFalsy();
    }
    done();
  });

  test('Verify issue #37: property description preserved on description/$ref', (done) => {
    // See
    const input = {
      "components": {
        "schemas": {
          "x": {
            "title": "X",
            "description": "X (schema)",
            "type": "string",
            "minLength": 0,
            "maxLength": 16
          },
          "thing": {
            "title": "Thing",
            "description": "A thing",
            "type": "object",
            "properties": {
              "x": {
                "description": "x (property)",
                "$ref": "#/components/schemas/x"
              }
            }
          }
        }
      }
    };
    const expected = {
      "components": {
        "schemas": {
          "x": {
            "title": "X",
            "description": "X (schema)",
            "type": "string",
            "minLength": 0,
            "maxLength": 16
          },
          "thing": {
            "title": "Thing",
            "description": "A thing",
            "type": "object",
            "properties": {
              "x": {
                "description": "x (property)",
                "allOf": [
                  { "$ref": "#/components/schemas/x"  }
                ]
              }
            }
          }
        }
      }
    };
    const converter = new Converter(input, { allOfTransform: true, deleteExampleWithId: true });
    const converted: any = converter.convert();
    {
      expect(JSON.stringify(converted.components)).toEqual(JSON.stringify(expected.components));
    }
    done();
  });


  test('Convert schema $ref/examples to example', (done) => {
    const input = {
      openapi: '3.1.0',
      components: {
        schemas: {
          a: {
            type: 'string',
            examples: ['foo', 'bar'],
          },
          b: {
            description: 'a B string based on components/schemas/a',
            title: 'a B string',
            $ref: '#/components/schemas/a',
            examples: ['Foo', 'Bar'],
          },
        },
      },
    };
    const converter = new Converter(input, { allOfTransform: true });
    const converted: any = converter.convert();
    {
      const a = converted.components.schemas.a;
      expect(a.examples).toBeUndefined();
      const example = a.example;
      expect(example).toEqual('foo');
    }
    {
      const b = converted.components.schemas.b;
      expect(b.examples).toBeUndefined();
      const example = b.example;
      expect(example).toEqual('Foo');
    }
    done();
  });

  test('Remove $id and $schema keywords', (done) => {
    const input = {
      openapi: '3.1.0',
      components: {
        schemas: {
          a: {
            $id: 'http://www.example.com/schemas/a',
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            type: 'string',
          },
        },
      },
    };
    const expected = {
      openapi: '3.0.3',
      components: {
        schemas: {
          a: {
            type: 'string',
          },
        },
      },
    };
    const converter = new Converter(input, { verbose: true });
    const converted: any = converter.convert();
    expect(converted).toEqual(expected);
    done();
  });

  test('Convert schema $comment to x-comment', (done) => {
    const input = {
      components: {
        schemas: {
          a: {
            type: 'string',
            $comment: 'This is a comment.',
          },
        },
      },
    };
    const converter = new Converter(input, { convertSchemaComments: true });
    const converted: any = converter.convert();

    const a = converted.components.schemas.a;
    expect(a.$comment).toBeUndefined();
    const comment = a['x-comment'];
    expect(comment).toEqual('This is a comment.');

    done();
  });

  test('Remove unevaluatedProperties keywords', (done) => {
    const input = {
      openapi: '3.1.0',
      components: {
        schemas: {
          a: {
            type: 'object',
            unevaluatedProperties: false,
            properties: {
              b: {
                type: 'object',
                unevaluatedProperties: false,
                properties: {
                  s: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
      },
    };
    const expected = {
      openapi: '3.0.3',
      components: {
        schemas: {
          a: {
            type: 'object',
            properties: {
              b: {
                type: 'object',
                properties: {
                  s: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
      },
    };
    const converter = new Converter(input, { verbose: true });
    const converted: any = converter.convert();
    expect(converted).toEqual(expected);
    done();
  });


  test('Remove patternProperties keywords', (done) => {
    const input = {
      openapi: '3.1.0',
      components: {
        schemas: {
          a: {
            type: 'object',
            properties: {
                  s: {
                    type: 'string',
                  },
            },
            patternProperties: {
            "^[a-z{2}-[A-Z]{2,3}]$": {
                type: 'object',
                unevaluatedProperties: false,
                properties: {
                  t: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
      },
    };
    const expected = {
      openapi: '3.0.3',
      components: {
        schemas: {
          a: {
            type: 'object',
            properties: {
              s: {
                type: 'string',
              },
            },
          },
        },
      },
    };
    const converter = new Converter(input, { verbose: true });
    const converted: any = converter.convert();
    expect(converted).toEqual(expected);
    done();
  });

  test('Remove propertyNames keywords', (done) => {
    const input = {
      openapi: '3.1.0',
      components: {
        schemas: {
          a: {
            type: "object",
            propertyNames: {
              pattern: "^[A-Za-z_][A-Za-z0-9_]*$",
            },
            additionalProperties: {
              type: "string",
            }
          },
        },
      },
    };
    const expected = {
      openapi: '3.0.3',
      components: {
        schemas: {
          a: {
            type: "object",
            additionalProperties: {
              type: "string",
            }
          },
        },
      },
    };
    const converter = new Converter(input, { verbose: true });
    const converted: any = converter.convert();
    expect(converted).toEqual(expected);
    done();
  });

  test('Remove contentMediaType keywords', (done) => {
    const input = {
      openapi: '3.1.0',
      components: {
        schemas: {
          a: {
            type: 'object',
            unevaluatedProperties: false,
            properties: {
              b: {
                type: 'string',
                contentMediaType: 'application/pdf',
                maxLength: 5000000
              },
            },
          },
        },
      },
    };
    const expected = {
      openapi: '3.0.3',
      components: {
        schemas: {
          a: {
            type: 'object',
            properties: {
              b: {
                type: 'string',
                maxLength: 5000000
              },
            },
          },
        },
      },
    };
    const converter = new Converter(input, { verbose: true });
    const converted: any = converter.convert();
    expect(converted).toEqual(expected);
    done();
  });


   test('Remove webhooks object', (done) => {
    const input = {
      openapi: '3.1.0',
        webhooks: {
          newThing: {
            post: {
              requestBody: {
                description: 'Information about a new thing in the system',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/newThing'
                    }
                  }
                }
              },
              responses: {
                200: {
                  description: 'Return a 200 status to indicate that the data was received successfully'
                }
              }
            }
          }
        }
    };

    const expected = {
      openapi: '3.0.3'
    };

    const converter = new Converter(input, { verbose: true });
    const converted: any = converter.convert();
    expect(converted).toEqual(expected);
    done();
  });

  test('Remove $id and $schema keywords', (done) => {
    const input = {
      openapi: '3.1.0',
      components: {
        schemas: {
          a: {
            $id: 'http://www.example.com/schemas/a',
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            type: 'string',
          },
        },
      },
    };
    const expected = {
      openapi: '3.0.3',
      components: {
        schemas: {
          a: {
            type: 'string',
          },
        },
      },
    };
    const converter = new Converter(input, { verbose: true });
    const converted: any = converter.convert();
    expect(converted).toEqual(expected);
    done();
  });

  test('Rename $comment to x-comment', (done) => {
    const input = {
      openapi: '3.1.0',
      components: {
        schemas: {
          a: {
            type: 'object',
            $comment: 'a comment on schema a',
            properties: {
              b: {
                type: 'object',
                $comment: 'A comment on a.b',
                properties: {
                  s: {
                    type: 'string',
                    $comment: 'A comment on a.b.s',
                  },
                },
              },
            },
          },
        },
      },
    };
    const expected = {
      openapi: '3.0.3',
      components: {
        schemas: {
          a: {
            type: 'object',
            'x-comment': 'a comment on schema a',
            properties: {
              b: {
                type: 'object',

                'x-comment': 'A comment on a.b',
                properties: {
                  s: {
                    type: 'string',
                    'x-comment': 'A comment on a.b.s',
                  },
                },
              },
            },
          },
        },
      },
    };
    const converter = new Converter(input, { verbose: true, convertSchemaComments: true });
    const converted: any = converter.convert();
    expect(converted).toEqual(expected);
    done();
  });

  test('Delete $comment (not convert to x-comment)', (done) => {
    const input = {
      openapi: '3.1.0',
      components: {
        schemas: {
          a: {
            type: 'object',
            $comment: 'a comment on schema a',
            properties: {
              b: {
                type: 'object',
                $comment: 'A comment on a.b',
                properties: {
                  s: {
                    type: 'string',
                    $comment: 'A comment on a.b.s',
                  },
                },
              },
            },
          },
        },
      },
    };
    const expected = {
      openapi: '3.0.3',
      components: {
        schemas: {
          a: {
            type: 'object',
            properties: {
              b: {
                type: 'object',
                properties: {
                  s: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
      },
    };
    const converter = new Converter(input, { verbose: true });
    const converted: any = converter.convert();
    expect(converted).toEqual(expected);
    done();
  });

  test('Convert nullable type array', (done) => {
    const input = {
      components: {
        schemas: {
          a: {
            type: ['string', 'null'],
          },
        },
      },
    };
    const expected = {
      openapi: '3.0.3',
      components: {
        schemas: {
          a: {
            type: 'string',
            nullable: true,
          },
        },
      },
    };
    const converter = new Converter(input, { verbose: true });
    const converted: any = converter.convert();
    expect(converted).toEqual(expected);
    done();
  });

  test('Convert const to enum', (done) => {
    const input = {
      components: {
        schemas: {
          version: {
            type: 'string',
            const: '1.0.0',
          },
          nested: {
            type: 'object',
            properties: {
              oneOf: [
                {
                  type: 'object',
                  properties: {
                    type: {
                      const: 's',
                    },
                    value: {
                      type: 'string',
                    },
                  },
                },
                {
                  type: 'object',
                  properties: {
                    type: {
                      const: 'n',
                    },
                    value: {
                      type: 'number',
                    },
                  },
                },
              ],
            },
          },
        },
      },
    };
    const expected = {
      openapi: '3.0.3',
      components: {
        schemas: {
          version: {
            type: 'string',
            enum: ['1.0.0'],
          },
          nested: {
            type: 'object',
            properties: {
              oneOf: [
                {
                  type: 'object',
                  properties: {
                    type: {
                      enum: ['s'],
                    },
                    value: {
                      type: 'string',
                    },
                  },
                },
                {
                  type: 'object',
                  properties: {
                    type: {
                      enum: ['n'],
                    },
                    value: {
                      type: 'number',
                    },
                  },
                },
              ],
            },
          },
        },
      },
    };
    const converter = new Converter(input, { allOfTransform: true });
    const converted: any = converter.convert();
    {
      // The following tests fail if we use toEqual here, even though the objects look identical:
      // expect(converted).toMatchObject(expected);
      // expect(converted.components).toMatchObject(expected.components);
      // Expected: {"schemas": {"nested": {"properties": {"oneOf": [{"properties": {"type": {"enum": ["s"]}, "value": {"type": "string"}}, "type": "object"}, {"properties": {"type": {"enum": ["n"]}, "value": {"type": "number"}}, "type": "object"}]}, "type": "object"}, "version": {"enum": ["1.0.0"], "type": "string"}}}
      // Received: serializes to the same string
      //
      // so we simplify and compare the components.schemas part only
      expect(JSON.stringify(converted.components)).toEqual(JSON.stringify(expected.components));
      // even though jest reports
    }
    done();
  });

  test('Remove info.license.identifier', (done) => {
    const input = {
      openapi: '3.1.0',
      info: {
        license: {
          name: 'MIT',
          identifier: 'MIT',
        },
      },
    };
    const expected = {
      openapi: '3.0.3',
      info: {
        license: {
          name: 'MIT',
        },
      },
    };
    const converter = new Converter(input, { verbose: true });
    const converted: any = converter.convert();
    expect(converted).toEqual(expected);
    done();
  });

  test('Convert larger example', (done) => {
    const sourceFileName = path.join(__dirname, 'data/openapi.yaml'); // __dirname is the test dir
    const scopesFileName = path.join(__dirname, 'data/scopes.yaml');
    const source = fs.readFileSync(sourceFileName, 'utf8');
    const input = yaml.load(source) as object;
    expect(input).toBeDefined();
    const cOpts: ConverterOptions = { verbose: true, deleteExampleWithId: true, scopeDescriptionFile: scopesFileName };
    const converter = new Converter(input, cOpts);
    const converted: any = converter.convert();
    const appIdPathParam = converted.components.parameters.appIdPathParam;
    const keys = Object.keys(appIdPathParam);
    const expectedKeys = ['name', 'description', 'in', 'required', 'schema'];
    expect(keys.sort()).toEqual(expectedKeys.sort());
    const scopes = converted.components.securitySchemes.accessToken.flows.authorizationCode.scopes;
    expect(scopes['scope1']).toEqual('Allow the application to access your personal profile data.');
    expect(scopes['scope3']).toEqual(`TODO: describe the 'scope3' scope`);
    const publicOp = (converted.paths['/users/{appId}/public-preferences'] as object)['get'];
    expect(publicOp['security']).toBeFalsy();
    done();
  });
});

test('binary encoded data with existing binary format', (done) => {
  const input = {
    openapi: '3.1.0',
    components: {
      schemas: {
        binaryEncodedDataWithExistingBinaryFormat: {
          type: 'string',
          format: 'binary',
          contentEncoding: 'base64',
        },
      },
    },
  };
  const converter = new Converter(input);
  let caught = false;
  try {
      converter.convert();
  } catch (e) {
    caught = true;
  }
  expect(caught).toBeTruthy()
  // TODO how to check that Converter logged a specific note?
  done();
});

test('binary encoded data with byte format', (done) => {
  const input = {
    openapi: '3.1.0',
    components: {
      schemas: {
        binaryEncodedDataWithByteFormat: {
          type: 'string',
          format: 'byte',
          contentEncoding: 'base64',
        },
      },
    },
  };
  const expected = {
    openapi: '3.0.3',
    components: {
      schemas: {
        binaryEncodedDataWithByteFormat: {
          type: 'string',
          format: 'byte',
        },
      },
    },
  };
  const converter = new Converter(input);
  const converted: any = converter.convert();
  expect(converted).toEqual(expected);
  done();
});

test('binary encoded data with no existing format', (done) => {
  const input = {
    openapi: '3.1.0',
    components: {
      schemas: {
        binaryEncodedDataWithNoFormat: {
          type: 'string',
          contentEncoding: 'base64',
        },
      },
    },
  };
  const expected = {
    openapi: '3.0.3',
    components: {
      schemas: {
        binaryEncodedDataWithNoFormat: {
          type: 'string',
          format: 'byte',
        },
      },
    },
  };
  const converter = new Converter(input);
  const converted: any = converter.convert();
  expect(converted).toEqual(expected);
  done();
});

test('contentMediaType with existing binary format', (done) => {
  const input = {
    openapi: '3.1.0',
    components: {
      schemas: {
        binaryEncodedDataWithExistingBinaryFormat: {
          type: 'string',
          contentMediaType: 'application/octet-stream',
          format: 'binary'
        },
      },
    },
  };
  const expected = {
    openapi: '3.0.3',
    components: {
      schemas: {
        binaryEncodedDataWithExistingBinaryFormat: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  };
  const converter = new Converter(input);
  const converted: any = converter.convert();
  expect(converted).toEqual(expected);
  // TODO how to check that Converter logged to console.warn ?
  done();
});


test('contentMediaType with no existing format', (done) => {
  const input = {
    openapi: '3.1.0',
    components: {
      schemas: {
        binaryEncodedDataWithExistingBinaryFormat: {
          type: 'string',
          contentMediaType: 'application/octet-stream',
        },
      },
    },
  };
  const expected = {
    openapi: '3.0.3',
    components: {
      schemas: {
        binaryEncodedDataWithExistingBinaryFormat: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  };
  const converter = new Converter(input);
  const converted: any = converter.convert();
  expect(converted).toEqual(expected);
  // TODO how to check that Converter logged to console.warn ?
  done();
});

test('contentMediaType with existing unexpected format', (done) => {
  const input = {
    openapi: '3.1.0',
    components: {
      schemas: {
        binaryEncodedDataWithExistingBinaryFormat: {
          type: 'string',
          contentMediaType: 'application/octet-stream',
          format: 'byte'
        },
      },
    },
  };

   const converter = new Converter(input);
   let caught = false;
   try {
     converter.convert();
   } catch (e) {
     caught = true;
   }
   expect(caught).toBeTruthy();
  // TODO how to check that Converter logged to console.warn ?
  done();
});
