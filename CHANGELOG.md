# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2025-08-02

### Added

- Random key mode (`keyMode: 'random'`) for ephemeral session signers without passkeys
- Support for environments without WebAuthn/passkey support
- `KEY_GENERATION_FAILED` error code for random key generation failures

### Changed

- Updated dependencies to latest versions
- Demo app upgraded to Tailwind CSS 4.1.11 and DaisyUI 5.0.50
- Updated CosmJS types to 0.10.1

## [0.4.0] - 2025-07-14

### Added

- Time-bound passkey salts with cleaner namespacing
- Window-based key rotation for enhanced security
- `stintWindowHours` configuration option for custom rotation intervals
- `usePreviousWindow` option for grace period handling
- `getWindowBoundaries` utility function

### Changed

- Improved passkey salt generation to be time-window based
- Better namespace separation for different applications

## [0.3.2] - 2025-07-13

### Fixed

- Security dependency update for CosmJS
- Added comprehensive test coverage for execute.ts
- Added test coverage for passkey.ts

### Changed

- Updated CI configuration for consistency with local development

## [0.3.1] - 2025-07-12

### Added

- Address validation to ensure primary wallet and passkey match
- Safety check preventing mismatched wallet/passkey combinations

### Changed

- Removed emoji from code for cleaner implementation

## [0.3.0] - 2025-07-07

### Added

- Execute helpers to SessionSigner for simplified authz transactions
- `execute.send()` method for easy token transfers with authz
- `execute.custom()` method for custom message execution with authz
- `.well-known` directory support in demo application

### Changed

- Improved developer experience with higher-level transaction methods

## [0.2.4] - 2025-07-05

### Fixed

- Console logger implementation in core library and examples
- Logger interface consistency across the project

## [0.2.3] - 2025-07-04

### Changed

- Updated dependencies for demo application
- Minor dependency updates across the project

### Added

- `.gitignore` for dither-post-demo

## [0.2.2] - 2025-06-30

### Changed

- Updated documentation for cleaner npm package presentation
- Version bump for improved npm visibility

## [0.2.1] - 2025-06-28

### Fixed

- Updated README with clearer documentation
- Small improvements to documentation formatting

### Changed

- NPM package metadata improvements

## [0.2.0] - 2025-06-28

### Added

- Streamlined API with `newSessionSigner` as the primary entry point
- Enhanced security features including:
  - Secure challenge generation
  - RP ID validation
  - Response size validation for REST calls
  - Content type validation
  - Request timeouts
- Comprehensive error handling with custom error types
- Logger interface with console and no-op implementations
- CodeCov and Snyk integration for CI

### Changed

- Simplified developer experience with single-function session creation
- Improved error messages with actionable guidance
- Better TypeScript types and interfaces

### Security

- Added multiple security validations for WebAuthn operations
- Implemented secure URL conversion with validation
- Added request size limits and timeout protections

## [0.1.0] - 2025-06-27

### Added

- Initial MVP implementation
- WebAuthn passkey support for session signer creation
- Deterministic key derivation using PRF extension
- Cosmos SDK authz and feegrant integration
- Basic session signer functionality
- Demo application for Dither integration
- CI/CD pipeline setup
- Core features:
  - Session signer creation from passkeys
  - Authz grant generation
  - Feegrant allowance setup
  - Grant checking utilities
  - Revocation message generation

[Unreleased]: https://github.com/n2p5/stint/compare/v0.4.0...HEAD
[0.5.0]: https://github.com/n2p5/stint/compare/v0.3.2...v0.5.0
[0.4.0]: https://github.com/n2p5/stint/compare/v0.3.2...v0.4.0
[0.3.2]: https://github.com/n2p5/stint/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/n2p5/stint/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/n2p5/stint/compare/v0.2.4...v0.3.0
[0.2.4]: https://github.com/n2p5/stint/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/n2p5/stint/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/n2p5/stint/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/n2p5/stint/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/n2p5/stint/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/n2p5/stint/releases/tag/v0.1.0
