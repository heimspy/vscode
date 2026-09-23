# Repository boundaries

| Repository | Ownership |
| --- | --- |
| [heimspy/vscode](https://github.com/heimspy/vscode) | Extension, React webview, agent/core assembly, platform builds, licenses, VSIX and store releases |
| [heimspy/agent](https://github.com/heimspy/agent) | Node service, capture policies, MCP, model/protocol and integration tests |
| [heimspy/sing-box](https://github.com/heimspy/sing-box) | Upstream fork, inspector source, Go race tests, vet and dependency scan |

Vscode pins agent in package.json/package-lock.json and the fork independently in
`sing-box.lock.json`. Its `scripts/build-core.mjs` fetches that exact fork revision
and writes the binary, source/hash manifest and notices to `core/<platform>-<arch>`.
`HEIMSPY_SING_BOX_SOURCE` selects a clean local checkout at the pinned revision.
The fork cache is under `.build/sing-box/<sha>`; no embedded source or submodule is used.

Agent has its own `sing-box.lock.json` for integration tests. Its `test:core` script
builds a local fixture only, not distribution artifacts. It has no dependency on
vscode or the retired core repository. Active builds fetch the sing-box fork directly.

The display name is Heimspy; extension ID `fqix.tapline`, command/setting/view IDs
are preserved. Linux trust-store certificate filenames use `heimspy-root-ca`. Agent and extension versions are independent.

## Updating

1. Commit/test fork changes with `bash scripts/test-heimspy.sh` in sing-box.
2. Update agent's test pin, run `test:core`, typecheck, build and tests, then commit.
3. In vscode, pin the tested agent Git SHA and update its own sing-box.lock.json.
   Regenerate package-lock.json with `npm install --package-lock-only --ignore-scripts`.
4. Run `core:build`, typecheck, build, tests, E2E and package in vscode.
   Publish a GitHub release to run the existing Marketplace/Open VSX workflow.

For local agent development, `npm pack` in agent and install that tarball in vscode
with `npm install --no-save --package-lock=false /absolute/path/to/package.tgz`.
Restore using `npm ci --ignore-scripts`.

## History and publication

Relevant Git history was extracted from `heimspy/heimspy` at `7478a34`; the original
repository retains the complete history and old tags. The native build script was
subsequently migrated from core to vscode; the separate core repository is no longer used.

Store publication requires the vscode repository's `marketplace-publish` environment,
`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `OVSX_PAT` and the corresponding Azure federated
identity subject. Normal pushes only run CI, not store publication.
