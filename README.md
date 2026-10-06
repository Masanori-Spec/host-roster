# HostRoster — native-first feasibility

This repository is a source-only feasibility gate, not a finished application. There is no UI or SSH connection feature. Native Zed acceptance is **not established until the actual Rust consumer workflow passes**. JavaScript unit-test success alone is insufficient.

The experiment inventories literal aliases from an explicitly supplied virtual SSH config Include closure, lets a fixture select aliases and project paths, and emits a Zed `ssh_connections` JSON fragment. Existing entries retain their parsed JSON values unchanged; only missing selected aliases are appended. New entries have only `host`, `projects`, and an optional explicitly entered `nickname`. It never copies HostName, User, Port, IdentityFile, ProxyJump, or commands into new entries.

## Safety and scope

- All fixtures use synthetic `.invalid` hosts
- No real `~/.ssh`, keys, user connections, Zed profile, or account settings are read or changed
- No `ssh`, network connection, command execution from config, permission expansion, or persistent access is attempted
- Only the user-supplied virtual files are considered; absent Include matches are an error
- Relative Includes and `~/.ssh/` Includes are anchored at the virtual `~/.ssh` root, never the including file's directory
- Includes are accepted only before the first Host in their file; Match/exec and conditional Includes are rejected
- Whole pattern-bearing Host lines are omitted conservatively and reported, including literal aliases next to a negation
- No full OpenSSH evaluation, filesystem coverage, effective connection setting, GUI, or connectivity guarantee is made

Limits: 32 files, 256 Host tokens/connections, eight file levels, 512 KiB complete JSON input, depth 16, 8192 JSON nodes, 256 Include visits, two million wildcard comparison cells, and 1 MiB output/report. Include globs support `*`/`?` within path segments with POSIX leading-dot exclusion. Unsupported quoting, continuations, non-ASCII syntax whitespace outside comments, bracket globs, absolute paths, traversal, escapes, cycles, unsafe aliases, private-key markers anywhere in input, and missing references fail closed.

Existing JSON values are preserved semantically, not as original source bytes, formatting, or key whitespace. Existing input must be an `ssh_connections` fragment rather than a full settings file, avoiding accidental loss of unrelated settings. Known existing connection fields receive conservative type/size checks; malformed ports, projects, args, and optional fields are rejected. Accepted unknown fields remain unchanged. This is not universal runtime acceptance: the real upstream consumer gate covers the synthetic fixture and explicit negative controls. Unsafe integers and negative zero are rejected rather than silently normalized.

## Local source checks

```sh
npm test
npm run fixture
```

The 28 tests use Node's standard library only. They cover Include anchoring/order, literal discovery, skipping patterns, unchanged existing entries, restricted new fields, missing/cyclic/conditional Includes, unsafe aliases, key markers, and bounds.

## Actual native consumer gate

Pinned upstream: Zed v1.22.0, commit `76659a55a8c10ed355a070f8764a0b1733e3c115`, Rust 1.98.1.

```sh
python scripts/prepare-native.py
rustup toolchain install 1.98.1 --profile minimal
cargo +1.98.1 run --manifest-path .native/probe/Cargo.toml -- fixtures/include-closure.json evidence/generated-fragment.json > evidence/zed-native-result.json
python scripts/check-native-evidence.py
```

The test setup fetches official upstream files, verifies byte count, Git blob SHA, and SHA-256, and keeps them in ignored `.native/`. It mechanically extracts unchanged definitions of `RemoteSettingsContent`, `SshConnection`, `RemoteProject`, and their dependent types. Actual unchanged `settings_macros`, `fallible_options`, merge support, and collection code are compiled. No handwritten replacement schema or semantic stub substitutes for deserialization. See [native method](docs/NATIVE_METHOD.md).

The native driver must accept four expected connections with exact project/nickname values and reject six malformed-property controls, including a recovered optional-field error that must not count as success. The actual pinned root-only SSH suggestion parser is also exercised on the synthetic root file, separately proving the fixture's Include-discovery gap. That parser does **not** validate the JSON fragment.

The gate establishes only actual upstream settings-deserializer acceptance for the fixture. It does not run Zed's GUI, complete SettingsStore/profile merging, or any SSH connection. CI evidence must be checked before proceeding to UI development.

## Research and licensing

[Zed discussion #58721](https://github.com/zed-industries/zed/discussions/58721) reports missing Include-based host suggestions and names manual `ssh_connections` settings as a workaround. [Official remote-development documentation](https://zed.dev/docs/remote-development) defines the settings form. [SSHM](https://github.com/Gu1llaum-3/sshm) already supports Include-aware host management. The proposed difference is a narrow offline Include-to-Zed selection/project export workflow. Demand for this particular companion, novelty, and commercial viability are unvalidated; no new parsing algorithm is claimed.

No license grant is made for original HostRoster code. The gate downloads GPL-3.0-or-later Zed settings code and Apache-2.0 support code for ephemeral verification, retaining the pinned upstream license texts beside the generated probe. Downloaded sources, derived test binaries, `.native`, dependency caches, and registry packages are excluded from source/Library deliverables and CI artifacts. Only original test-driver/scripts, pin metadata, synthetic inputs, and reports are published. No Zed binary or vendor source is redistributed here.
