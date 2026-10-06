# Actual Zed deserializer method and limits

Status of this source snapshot: JavaScript tests and source extraction pass locally; native compilation/execution is unproved until CI runs. There is no GUI.

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

The actual Zed root-only suggestion parser must return only local-dev.invalid from the unexpanded root. The actual settings deserializer must accept all four emitted entries and their fixed expected values. Six malformed inputs must report failure: numeric host, missing host, non-array paths, numeric nickname, overflowing port, and non-array ssh_connections.

## What this does not prove

This is not a real GUI session, an SSH connection test, complete OpenSSH semantics, full settings-profile merge validation, or a guarantee about unlisted/user configs. Include parsing is deliberately bounded, and existing JSON preservation refers to parsed values rather than bytes. No actual user config/key path is opened; fixture paths are JSON keys only. No SSH binary is invoked.

## Distribution boundary

Official files are fetched into ignored `.native/` only for verification, with original GPL/Apache license texts. CI uploads only `evidence/`, never the generated upstream source tree, compiled executable, registry caches, or toolchain. Public source/Library archives exclude `.native/`. There is no original-code license grant or assertion that upstream licenses apply to unrelated HostRoster code.
