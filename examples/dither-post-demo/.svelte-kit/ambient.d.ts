
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * Environment variables [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env`. Like [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), this module cannot be imported into client-side code. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * _Unlike_ [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), the values exported from this module are statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * ```ts
 * import { API_KEY } from '$env/static/private';
 * ```
 * 
 * Note that all environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * 
 * ```
 * MY_FEATURE_FLAG=""
 * ```
 * 
 * You can override `.env` values from the command line like so:
 * 
 * ```bash
 * MY_FEATURE_FLAG="enabled" npm run dev
 * ```
 */
declare module '$env/static/private' {
	export const N_2P5_XYZ_CDN_DIST_ID: string;
	export const LDFLAGS: string;
	export const TERM_PROGRAM: string;
	export const HASHMAP_CDN_DIST_ID: string;
	export const NODE: string;
	export const INIT_CWD: string;
	export const TERM: string;
	export const SHELL: string;
	export const NOMASTERS_CDN_DIST_ID: string;
	export const CLICOLOR: string;
	export const CPPFLAGS: string;
	export const HOMEBREW_REPOSITORY: string;
	export const TMPDIR: string;
	export const TERM_PROGRAM_VERSION: string;
	export const ZDOTDIR: string;
	export const ORIGINAL_XDG_CURRENT_DESKTOP: string;
	export const MallocNanoZone: string;
	export const npm_config_registry: string;
	export const ENABLE_IDE_INTEGRATION: string;
	export const AWS_PAGER: string;
	export const ZSH: string;
	export const USER: string;
	export const npm_config_recursive: string;
	export const LS_COLORS: string;
	export const COMMAND_MODE: string;
	export const PNPM_SCRIPT_SRC_DIR: string;
	export const CLAUDE_CODE_SSE_PORT: string;
	export const FUNCIMP_S3_BUCKET: string;
	export const SSH_AUTH_SOCK: string;
	export const VSCODE_PROFILE_INITIALIZED: string;
	export const __CF_USER_TEXT_ENCODING: string;
	export const npm_execpath: string;
	export const PAGER: string;
	export const LSCOLORS: string;
	export const npm_config_verify_deps_before_run: string;
	export const npm_config_frozen_lockfile: string;
	export const PATH: string;
	export const npm_package_json: string;
	export const USER_ZDOTDIR: string;
	export const __CFBundleIdentifier: string;
	export const PWD: string;
	export const npm_command: string;
	export const npm_config__jsr_registry: string;
	export const npm_lifecycle_event: string;
	export const LANG: string;
	export const npm_package_name: string;
	export const NODE_PATH: string;
	export const LIFTPLAN_LAMBDA_S3_BUCKET: string;
	export const VSCODE_GIT_ASKPASS_EXTRA_ARGS: string;
	export const XPC_FLAGS: string;
	export const npm_config_node_gyp: string;
	export const pnpm_config_verify_deps_before_run: string;
	export const XPC_SERVICE_NAME: string;
	export const npm_package_version: string;
	export const VSCODE_INJECTION: string;
	export const RJRBT_CDN_DIST_ID: string;
	export const SHLVL: string;
	export const HOME: string;
	export const VSCODE_GIT_ASKPASS_MAIN: string;
	export const GH_ROOT: string;
	export const HOMEBREW_PREFIX: string;
	export const LESS: string;
	export const LOGNAME: string;
	export const npm_lifecycle_script: string;
	export const VSCODE_GIT_IPC_HANDLE: string;
	export const GOPATH: string;
	export const npm_config_user_agent: string;
	export const VSCODE_GIT_ASKPASS_NODE: string;
	export const GIT_ASKPASS: string;
	export const INFOPATH: string;
	export const HOMEBREW_CELLAR: string;
	export const GNOROOT: string;
	export const FUNCIMP_DIST_ID: string;
	export const KILLCORD_CDN_DIST_ID: string;
	export const COLORTERM: string;
	export const npm_node_execpath: string;
	export const NODE_ENV: string;
}

/**
 * Similar to [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private), except that it only includes environment variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Values are replaced statically at build time.
 * 
 * ```ts
 * import { PUBLIC_BASE_URL } from '$env/static/public';
 * ```
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to runtime environment variables, as defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * This module cannot be imported into client-side code.
 * 
 * Dynamic environment variables cannot be used during prerendering.
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * console.log(env.DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 * 
 * > In `dev`, `$env/dynamic` always includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 */
declare module '$env/dynamic/private' {
	export const env: {
		N_2P5_XYZ_CDN_DIST_ID: string;
		LDFLAGS: string;
		TERM_PROGRAM: string;
		HASHMAP_CDN_DIST_ID: string;
		NODE: string;
		INIT_CWD: string;
		TERM: string;
		SHELL: string;
		NOMASTERS_CDN_DIST_ID: string;
		CLICOLOR: string;
		CPPFLAGS: string;
		HOMEBREW_REPOSITORY: string;
		TMPDIR: string;
		TERM_PROGRAM_VERSION: string;
		ZDOTDIR: string;
		ORIGINAL_XDG_CURRENT_DESKTOP: string;
		MallocNanoZone: string;
		npm_config_registry: string;
		ENABLE_IDE_INTEGRATION: string;
		AWS_PAGER: string;
		ZSH: string;
		USER: string;
		npm_config_recursive: string;
		LS_COLORS: string;
		COMMAND_MODE: string;
		PNPM_SCRIPT_SRC_DIR: string;
		CLAUDE_CODE_SSE_PORT: string;
		FUNCIMP_S3_BUCKET: string;
		SSH_AUTH_SOCK: string;
		VSCODE_PROFILE_INITIALIZED: string;
		__CF_USER_TEXT_ENCODING: string;
		npm_execpath: string;
		PAGER: string;
		LSCOLORS: string;
		npm_config_verify_deps_before_run: string;
		npm_config_frozen_lockfile: string;
		PATH: string;
		npm_package_json: string;
		USER_ZDOTDIR: string;
		__CFBundleIdentifier: string;
		PWD: string;
		npm_command: string;
		npm_config__jsr_registry: string;
		npm_lifecycle_event: string;
		LANG: string;
		npm_package_name: string;
		NODE_PATH: string;
		LIFTPLAN_LAMBDA_S3_BUCKET: string;
		VSCODE_GIT_ASKPASS_EXTRA_ARGS: string;
		XPC_FLAGS: string;
		npm_config_node_gyp: string;
		pnpm_config_verify_deps_before_run: string;
		XPC_SERVICE_NAME: string;
		npm_package_version: string;
		VSCODE_INJECTION: string;
		RJRBT_CDN_DIST_ID: string;
		SHLVL: string;
		HOME: string;
		VSCODE_GIT_ASKPASS_MAIN: string;
		GH_ROOT: string;
		HOMEBREW_PREFIX: string;
		LESS: string;
		LOGNAME: string;
		npm_lifecycle_script: string;
		VSCODE_GIT_IPC_HANDLE: string;
		GOPATH: string;
		npm_config_user_agent: string;
		VSCODE_GIT_ASKPASS_NODE: string;
		GIT_ASKPASS: string;
		INFOPATH: string;
		HOMEBREW_CELLAR: string;
		GNOROOT: string;
		FUNCIMP_DIST_ID: string;
		KILLCORD_CDN_DIST_ID: string;
		COLORTERM: string;
		npm_node_execpath: string;
		NODE_ENV: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * Similar to [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), but only includes variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Note that public dynamic environment variables must all be sent from the server to the client, causing larger network requests — when possible, use `$env/static/public` instead.
 * 
 * Dynamic environment variables cannot be used during prerendering.
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.PUBLIC_DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
