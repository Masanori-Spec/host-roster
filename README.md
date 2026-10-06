# HostRoster

An offline SSH Include → Zed roster workbench. Import explicitly chosen config texts as a virtual-file JSON bundle, select aliases and project paths, then review/download an `ssh_connections` fragment. Japanese and English controls are available.

既存の項目を保ったまま、Include の先にあるエイリアスとプロジェクトを Zed 用の JSON 断片にまとめるオフライン補助ツールです。実際の SSH フォルダーや鍵は探索せず、接続や設定の書き込みも行いません。

## Run offline

Extract `host-roster-offline.zip`, then run:

```sh
python3 serve.py
# Windows: py serve.py
```

Open the printed loopback address, normally `http://127.0.0.1:8766/`. Python 3.10+ and a modern browser with module Worker support are sufficient. The bundle contains every runtime asset; no installation or internet is needed. Keep the terminal open and press Ctrl+C to stop. Use `--port 8767` if needed.

ZIP を展開し、同じフォルダーで `python3 serve.py`（Windows は `py serve.py`）を実行して、表示されるアドレスを開いてください。画面上部で日本語と英語を切り替えられます。

Do not double-click `index.html`: file:// module-worker restrictions require a local HTTP server. The server binds only to `127.0.0.1` and serves its own folder. Do not place private files in that folder while serving it. The public repository also includes built `dist/` assets; after GitHub **Code → Download ZIP**, serve them with:

```sh
python3 -m http.server 8766 --bind 127.0.0.1 --directory dist
```

This is public source plus an offline app. No hosted website is required.

## Use the workbench

1. Inspect the synthetic `.invalid` example and its Include expansion/provenance
2. Import or paste a complete JSON workspace. File names are relative to a virtual `~/.ssh`; Include paths use that root, not the including file's directory
3. Select literal aliases. Existing entries stay unchanged, even when unselected. Duplicate/case-only existing aliases are blocked rather than guessed
4. For each selected new alias, explicitly enter project groups (one per line, paths separated by `|`) and an optional nickname
5. Build and inspect the fragment, then save `ssh-connections.json`. Manually merge the fragment into the appropriate settings; it is not a replacement for a whole Zed settings file

`fixtures/include-closure.json` is the input example. Source text, existing fragment, and selection presets are explicit. There is no folder discovery. Unapplied input edits or changed selections make older output unsavable. Imports are bounded and validated before installation; superseded reads cannot overwrite newer work. Key markers are rejected without showing them in result previews.

Existing entries retain their parsed JSON values; original whitespace/key formatting is not preserved. Malformed known fields are rejected, while accepted unknown values stay intact. Ignored selection edits for already-existing aliases are sanitized before UI installation. New entries have only `host`, `projects`, and optional entered `nickname`; HostName/User/Port/IdentityFile/ProxyJump/commands from SSH text are never copied into them.

## Scope and limits

This is literal alias discovery and review, not complete OpenSSH evaluation. It does not establish actual config coverage, effective options, Zed GUI/profile behavior, or connectivity. Entire pattern-bearing Host lines are omitted conservatively and explained. Includes are supported only before the first Host in each file. Match/exec, conditional Includes, missing references, cycles, traversal, absolute paths, quoting, continuations, unsupported syntax whitespace, unsafe aliases, and key markers fail closed.

Limits: 32 files, 256 Host tokens/connections, eight file levels, 512 KiB complete JSON input, JSON depth 16, 8192 nodes, 256 Include visits, two million wildcard comparison cells, 1 MiB result/report, and an 8-second cancellable Worker deadline. Include `*` and `?` are segment-local and exclude leading-dot entries unless explicitly dotted. Reload restores the example; no autosave or persistence exists.

## Verification

[The original real native gate](https://github.com/Masanori-Spec/host-roster/actions/runs/37432374941) passed on exact commit `7caba20d09d773ccf1b0def6f673fa79d21b9d8c`: actual Zed v1.22.0 definitions/macros/deserializer compiled under Rust 1.98.1, accepted four fixed connections, and rejected six malformed controls. The pinned root-only suggestion parser independently demonstrated the Include-discovery gap. This was actual upstream `RemoteSettingsContent` deserialization, not a handwritten replacement struct or Zed GUI session.

The UI workflow adds an actual browser JSON download and sends those downloaded bytes through the same Rust consumer, with two additional corruptions of that fragment (eight negative controls total). The browser suite also covers JA/EN, keyboard selection, inert HTML, stale results, failed/pending imports, key-marker rejection without echo, duplicate ambiguity, mobile/base-text enlargement, and Worker failure. A prepared suite is not a passing result: [current workflow runs](https://github.com/Masanori-Spec/host-roster/actions/workflows/native-gate.yml) are the source of truth for the current published commit. See [native method](docs/NATIVE_METHOD.md).

Local build/package/source checks:

```sh
npm ci
npm run verify
```

This creates a deterministic ten-entry `release/host-roster-offline.zip`, checks the package, and runs source/packaged-worker/loopback tests. Native verification additionally uses the commands in NATIVE_METHOD.md. Real browser CI serves the extracted offline package with Chromium sandboxing retained on Ubuntu 22.04. No local-browser fallback or security bypass is needed.

## Research and licensing

[Zed discussion #58721](https://github.com/zed-industries/zed/discussions/58721) reports missing Include-based host suggestions and names manual `ssh_connections` settings as a workaround. [Official documentation](https://zed.dev/docs/remote-development) defines the settings form. [SSHM](https://github.com/Gu1llaum-3/sshm) already supports Include-aware host management. The difference explored here is a bounded offline Include-to-Zed selection/project export workflow. Demand, novelty, and commercial viability are unvalidated; no new parsing algorithm is claimed.

No license grant is made for original HostRoster code. Development tests fetch GPL-3.0-or-later Zed settings code and Apache-2.0 support code into ignored `.native/`, preserving actual bytes and upstream notices. These sources, compiled probes, toolchains, and caches are excluded from public/Library source deliverables and CI artifacts. No Zed source, binary, or third-party runtime code is included in the offline app. Only original code/scripts, pin metadata, synthetic inputs, and verification records are delivered.
