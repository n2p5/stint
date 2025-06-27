import { describe, it, expect } from 'vitest'
import { SigningStargateClient } from '@cosmjs/stargate'
import type {
  PasskeyCredential,
  StintConfig,
  DelegationConfig,
  SessionWalletConfig,
  AuthzGrantInfo,
  FeegrantInfo,
} from './types'

describe('type exports', () => {
  it('should export all required types', () => {
    // This test verifies that all types are properly exported
    // The test passes if TypeScript can compile this file

    // Example type usage to ensure they're properly defined
    const passkeyCredential: PasskeyCredential = {
      id: 'test-id',
      publicKey: new Uint8Array([1, 2, 3]),
      userId: 'user-123',
    }

    const stintConfig: StintConfig = {
      sessionExpiration: new Date(),
      spendLimit: { denom: 'uatom', amount: '1000' },
      gasLimit: { denom: 'uatom', amount: '500' },
      allowedRecipients: ['cosmos1...'],
    }

    const delegationConfig: DelegationConfig = {
      sessionExpiration: new Date(),
      spendLimit: { denom: 'uatom', amount: '1000' },
      gasLimit: { denom: 'uatom', amount: '500' },
      allowedRecipients: ['cosmos1...'],
    }

    const sessionWalletConfig: SessionWalletConfig = {
      primaryClient: {} as unknown as SigningStargateClient,
      saltName: 'test-salt',
    }

    const authzGrantInfo: AuthzGrantInfo = {
      authorization: {},
      expiration: new Date(),
    }

    const feegrantInfo: FeegrantInfo = {
      allowance: {},
      expiration: new Date(),
    }

    // Verify the types are structured correctly
    expect(passkeyCredential.id).toBe('test-id')
    expect(stintConfig.spendLimit?.denom).toBe('uatom')
    expect(delegationConfig.gasLimit?.amount).toBe('500')
    expect(sessionWalletConfig.saltName).toBe('test-salt')
    expect(authzGrantInfo.authorization).toBeDefined()
    expect(feegrantInfo.allowance).toBeDefined()
  })

  it('should handle optional fields correctly', () => {
    // Minimal configs with only required fields
    const minimalSessionWalletConfig: SessionWalletConfig = {
      primaryClient: {} as unknown as SigningStargateClient,
      // saltName is optional
    }

    const minimalDelegationConfig: DelegationConfig = {
      // all fields are optional
    }

    const minimalAuthzInfo: AuthzGrantInfo = {
      authorization: {},
      // expiration is optional
    }

    expect(minimalSessionWalletConfig.saltName).toBeUndefined()
    expect(minimalDelegationConfig.sessionExpiration).toBeUndefined()
    expect(minimalAuthzInfo.expiration).toBeUndefined()
  })
})
