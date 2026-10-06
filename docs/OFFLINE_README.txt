HostRoster offline app / オフライン版

Extract the ZIP. In that folder run: python3 serve.py
Windows: py serve.py
Open the printed address, normally http://127.0.0.1:8766/
Keep the terminal open; Ctrl+C stops it. Choose another port with --port 8767.

ZIP を展開し、そのフォルダーで python3 serve.py を実行してください。
Windows では py serve.py。表示される http://127.0.0.1:8766/ を開きます。
使っている間は端末を開いたままにし、終了は Ctrl+C です。

Python 3.10+ and a modern browser with module Worker support are sufficient.
No package installation or internet connection is needed to use this bundle.
Do not double-click index.html: file:// module-worker restrictions require the
local HTTP server. The server binds only to 127.0.0.1 and serves this folder.
Do not put private files in the app folder while serving it.

Python 3.10 以降とモジュール Worker 対応ブラウザーが必要です。
インストール作業やインターネット接続は不要です。index.html を直接
開く方式ではなく、同梱のローカルサーバーを使ってください。
サーバーはこのフォルダーだけを 127.0.0.1 で提供します。
サーバー稼働中は、このフォルダーに私的なファイルを置かないでください。

The app reads only explicitly imported JSON bundles containing virtual config
texts. It never discovers real SSH folders, reads keys, attempts SSH, creates
credentials, or writes Zed settings. New entries contain only host, projects,
and optional entered nickname. Existing fragment entries remain unchanged.
Inputs are in memory only; reload resets the synthetic .invalid example.

実際の SSH フォルダーや鍵は探索しません。明示的に読み込んだ仮想設定の
JSON だけを扱い、接続・認証情報の作成・Zed 設定の書き込みは行いません。
新規項目は host、projects、任意の nickname のみ。既存項目は保持します。
自動保存はなく、再読み込みで合成サンプルに戻ります。

Inspect downloaded ssh_connections JSON fragments before manually applying.
Do not replace a complete settings file with this fragment. The bounded native
test uses actual Zed v1.22.0 types/macros/deserialization, not the GUI, complete
SettingsStore/profile merging, or connectivity. It is not full OpenSSH parsing
or real-config coverage validation.

保存するのは設定全体ではなく ssh_connections 断片です。手動で適用する
前に内容を確認してください。型の読み込み試験は実際の Zed v1.22.0 の
コードを用いますが、GUI・SettingsStore 全体・プロファイル統合・接続を
検証するものではありません。実設定の網羅性も保証しません。

Source and evidence / ソースと検証記録:
https://github.com/Masanori-Spec/host-roster

CONTENTS.sha256 records the included files. No Zed source or binary is bundled
with this app. Upstream code is fetched separately only for development tests.
No license grant is made for original HostRoster code.
