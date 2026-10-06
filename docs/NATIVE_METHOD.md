# Actual Zed deserializer method and limits

The source-only native gate passed on exact commit 7caba20d09d773ccf1b0def6f673fa79d21b9d8c, run https://github.com/Masanori-Spec/host-roster/actions/runs/37432374941. The complete offline UI gate then passed on exact commit a6146257d37974e64a73699c16a45662b651958d, run https://github.com/Masanori-Spec/host-roster/actions/runs/37438119300: 34 source/package checks, four browser tests, and actual browser-download consumption by the same pinned upstream Rust implementation. Four expected entries were accepted; eight malformed controls were rejected. No Zed GUI session or SSH connection was tested.

## Upstream identity

Every selected file is pinned to Zed v1.22.0 commit 76659a55a8c10ed355a070f8764a0b1733e3c115. `scripts/upstream-lock.json` contains upstream byte counts, Git blob SHA-1 identities, and SHA-256 digests verified against GitHub metadata. Rust toolchain 1.98.1 is the tag's declared toolchain.

## Source isolation without replacement semantics

The probe uses these exact upstream components:

1. `settings_content.rs` lines 106–114: the real ParseStatus enum
2. `settings_content.rs` lines 1355–1435: the complete contiguous RemoteSettingsContent, DevContainerConnection, SshConnection, WslConnection, RemoteProject, and SshPortForwardOption definitions, including all serde attributes and derives
3. Full unchanged `settings_macros.rs`: the actual with_fallible_options and MergeFrom procedural macros
4. Full unchanged `fallible_options.rs`: actual lenient JSON/path-aware deserialization and recovery/error recording
5. Full unchanged `merge_from.rs` and actual collections/gpui_util support files
6. `language_model_core/request.rs` lines 524–532: the unchanged actual Speed enum needed by merge support, not a dummy stand-in
7. Full unchanged `recent_projects/src/ssh_config.rs`: actual root-only suggestion parsing, used for gap evidence only

The generated workspace changes crate manifests and import context to isolate those exact components without a full GPUI application build. It does not change fields, types, defaults, serde attributes, optional-error behavior, macros, or merge implementations. Registry dependencies are exact versions from upstream's Cargo.lock; the generated resolved lock is checked against upstream package version/checksum tuples and retained as evidence. If resolution diverges, the gate fails.

The original test driver calls `fallible_options::parse_json::<RemoteSettingsContent>` and requires `ParseStatus::Success`, not merely `Some(settings)`. All three layers are real upstream code: the types, macro-expanded serde behavior, and deserializer/error-recovery routine.

Zed's `recent_projects/src/remote_connections.rs` consumes these types through RemoteSettings::from_settings. That integration is source evidence only here: the full SettingsStore, GPUI remote-project listing, connection establishment, and authentication are not run or claimed.

## Fixture expectations

The root Includes `conf.d/*.conf` then declares local-dev.invalid. `10-work.conf` unconditionally Includes `shared/build.conf`, then declares work-dev.invalid/work-alt.invalid. `shared/build.conf` declares build-box.invalid; `20-personal.conf` declares personal-dev.invalid and a pattern-only block.

The generated fragment keeps local-dev.invalid's existing project/user/port/args and work-dev.invalid's existing nickname/project unchanged. Only work-alt.invalid and build-box.invalid are appended, with explicit projects and optional entered nickname. HostName and authentication/routing fields never populate new entries.

The actual Zed root-only suggestion parser must return only local-dev.invalid from the unexpanded root. The actual settings deserializer must accept all four emitted entries and their fixed expected values. The six baseline malformed inputs must report failure: numeric host, missing host, non-array paths, numeric nickname, overflowing port, and non-array ssh_connections. The UI gate adds two corruptions of the actual downloaded/generated fragment: replace a new project collection or host with a number. Both must fail the same real deserializer.

## What this does not prove

This is not a real GUI session, an SSH connection test, complete OpenSSH semantics, full settings-profile merge validation, or a guarantee about unlisted/user configs. Include parsing is deliberately bounded, and existing JSON preservation refers to parsed values rather than bytes. No actual user config/key path is opened; fixture paths are JSON keys only. No SSH binary is invoked.

## Distribution boundary

Official files are fetched into ignored `.native/` only for verification, with original GPL/Apache license texts. CI uploads verification reports, the offline release, browser downloads/screenshots, and the browser report (`evidence/`, `release/`, `test-results/`, `playwright-report/`). It never uploads `.native/`, generated upstream source, compiled native probes, registry caches, or the toolchain. Public source/Library archives exclude `.native/`. There is no original-code license grant or assertion that upstream licenses apply to unrelated HostRoster code.

## Reproduce current source and browser-consumer checks

```sh
npm ci
npm run verify
python scripts/prepare-native.py
rustup toolchain install 1.98.1 --profile minimal
cargo +1.98.1 run --manifest-path .native/probe/Cargo.toml -- fixtures/include-closure.json evidence/generated-fragment.json > evidence/zed-native-result.json
python scripts/check-native-evidence.py
npx playwright install --with-deps chromium
npm run test:browser
python scripts/consume-browser-download.py
```

The browser suite serves `.offline-preview/serve.py` and saves one actual `ssh-connections.json`. The final command consumes that file using the already built, locked same upstream Rust probe and requires the fixed four expected entries plus eight rejected controls. It is not a comparison against a JavaScript reimplementation of Zed's schema. CI uploads the actual download, offline package, screenshots, native results, compiler version, and resolved dependency-lock metadata; it never uploads `.native/` or its binaries.

## Verified browser artifact identities

The UI run artifact SHA-256 is `b912d3e33057967e41875f2f6b860d080761b9c8d245f91315500ac52e86d563`. The actual browser download is `76cdcffb32d3639fee796aae200dd09d2147e32a9b4d55eec2c1c64b0c436b27`; its two existing entries remain identical to the fixture and new entries contain only the allowed fields. The ten-entry offline ZIP is `ebafa795d38958a1d85854d3c5d108d7b1c6440ee78b79b70ecd70187b32bec6`, byte-identical between CI and the delivered bundle. All 41 resolved registry version/checksum tuples match the pinned upstream lock. These are identified historical results, not an automatic assertion about untested future source changes.
