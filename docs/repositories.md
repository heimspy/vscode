# Repository boundaries

| Repository | Ownership |
| --- | --- |
| [heimspy/vscode](https://github.com/heimspy/vscode) | Extension, React webview, UI preferences, VSIX, Marketplace/Open VSX |
| [heimspy/agent](https://github.com/heimspy/agent) | Node service, capture policies, MCP, model/protocol, integration helpers |
| [heimspy/core](https://github.com/heimspy/core) | Fork pin, native build/test/release |
| [heimspy/sing-box](https://github.com/heimspy/sing-box) | Upstream fork and Heimspy inspector source |

Dependencies run vscode → agent → core → the independent [sing-box fork](https://github.com/heimspy/sing-box). Shared code is imported from agent's package
exports, not copied. The agent's `core-lock.json` pins a full core commit and toolchain.
The extension bundles the agent with its own independent version. The display name and internal protocols use Heimspy. The extension ID `fqix.tapline`,
command/setting/view IDs and existing CA storage are preserved for compatibility.

## Updating

1. Commit and test changes on the sing-box fork, then update the core source pin and test/release core.
2. Update agent's `core-lock.json` to that SHA and toolchain, then run `core:build`,
   `build`, `typecheck`, `test` and `core:test`.
3. Commit the tested agent version. In vscode, update `@heimspy/agent` to
   `git+https://github.com/heimspy/agent.git#<full-sha>` and regenerate the lockfile
   with `npm install --package-lock-only --ignore-scripts`.
4. Run extension typechecks, build, tests, core build and E2E; package and release the VSIX.

For local development, `npm pack` in agent and install that tarball in vscode with
`npm install --no-save --package-lock=false /absolute/path/to/package.tgz`.
Restore using `npm ci --ignore-scripts`. Use `HEIMSPY_CORE_SOURCE` for a local core
checkout whose HEAD matches the pin; `HEIMSPY_SING_BOX_SOURCE` similarly selects a
clean fork checkout at the core pin.

## Migration and publishing

Relevant Git history was extracted from `heimspy/heimspy` at `7478a34`. Filtering
changes commit IDs. The original repository retains all history and old release
tags; old tags are not copied here.

Before publishing extensions, configure this repository's `marketplace-publish`
environment, `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `OVSX_PAT` and Azure federated
identity subject for this repository/environment. Credentials and account-side
trust do not migrate with Git history. Normal pushes only run CI.
