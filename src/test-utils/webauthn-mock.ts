import { vi, type Mock } from 'vitest'

interface WebAuthnMocks {
  mockCreate: Mock
  mockGet: Mock
}

interface MockCredential {
  id: string
  rawId: ArrayBuffer
  response: unknown
  type: 'public-key'
  authenticatorAttachment: null
  getClientExtensionResults: () => unknown
}

interface MockWebAuthnOptions {
  prfSupported?: boolean
  prfOutput?: Uint8Array
}

export function setupWebAuthnMock(options: MockWebAuthnOptions = {}): WebAuthnMocks {
  const { prfSupported = true, prfOutput = new Uint8Array(32).fill(42) } = options

  // Mock navigator.credentials.create
  const mockCreate = vi.fn().mockImplementation(async (_options: unknown) => {
    const credentialId = 'mock-credential-id'
    const rawId = new TextEncoder().encode(credentialId)

    return {
      id: credentialId,
      rawId: rawId.buffer,
      response: {
        clientDataJSON: new ArrayBuffer(0),
        attestationObject: new ArrayBuffer(0),
      },
      type: 'public-key',
      authenticatorAttachment: null,
      getClientExtensionResults: () => ({
        prf: prfSupported ? { enabled: true } : undefined,
      }),
    }
  })

  // Mock navigator.credentials.get
  const mockGet = vi
    .fn()
    .mockImplementation(async (options: { publicKey?: { allowCredentials?: unknown[] } }) => {
      if (!options.publicKey?.allowCredentials?.length) {
        // Discovery mode - return existing credential if available
        return {
          id: 'mock-credential-id',
          rawId: new ArrayBuffer(0),
          response: {
            authenticatorData: new ArrayBuffer(0),
            clientDataJSON: new ArrayBuffer(0),
            signature: new ArrayBuffer(0),
            userHandle: new TextEncoder().encode('atone1test123').buffer,
          },
          type: 'public-key',
          authenticatorAttachment: null,
          getClientExtensionResults: () => ({
            prf: prfSupported
              ? {
                  results: {
                    first: prfOutput,
                  },
                }
              : undefined,
          }),
        } as MockCredential
      }

      const credentialId = (options.publicKey.allowCredentials[0] as { id: string }).id

      return {
        id: typeof credentialId === 'string' ? credentialId : 'mock-credential-id',
        rawId: new ArrayBuffer(0),
        response: {
          authenticatorData: new ArrayBuffer(0),
          clientDataJSON: new ArrayBuffer(0),
          signature: new ArrayBuffer(0),
          userHandle: new TextEncoder().encode('atone1test123').buffer,
        },
        type: 'public-key',
        authenticatorAttachment: null,
        getClientExtensionResults: () => ({
          prf: prfSupported
            ? {
                results: {
                  first: prfOutput,
                },
              }
            : undefined,
        }),
      } as MockCredential
    })

  // Set up the mocks
  ;(global.navigator as any) = {
    ...global.navigator,
    credentials: {
      create: mockCreate,
      get: mockGet,
    },
  }

  // Mock PublicKeyCredential
  ;(global.window as any) = {
    ...global.window,
    PublicKeyCredential: class MockPublicKeyCredential {},
    location: { hostname: 'localhost' },
  }

  // Mock crypto.getRandomValues
  vi.spyOn(global.crypto, 'getRandomValues').mockImplementation((array: any) => {
    if (array) {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256)
      }
    }
    return array
  })

  return {
    mockCreate,
    mockGet,
  }
}

export function cleanupWebAuthnMock() {
  vi.clearAllMocks()
}
