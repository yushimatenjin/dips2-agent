# dips2-mcp-server

ドローン登録システム (DIPS-REG) の DRS API を Claude Code から扱えるようにする MCP サーバー。OAuth 2.0 / OpenID Connect (Keycloak) で認証し、登録済み機体一覧を取得する。

## 提供ツール (10種)

### 認証・セッション

| ツール | 機能 |
|---|---|
| `dips_login` | OAuth/OIDC フローでログイン（ブラウザ自動オープン） |
| `dips_logout` | 保存トークンを破棄 |
| `dips_session_status` | アクセストークンの残り時間を確認 |
| `dips_whoami` | 現在のログインユーザー情報 (sub, preferred_username) |

### 機体情報

| ツール | 機能 |
|---|---|
| `dips_list_aircrafts` | 機体一覧。製造番号・登録記号・ステータス・モデル名でフィルタ可。format で summary / json 切り替え |
| `dips_get_aircraft_detail` | 1機体の全情報を JSON で返す（serial か registrationCode 必須） |
| `dips_aircraft_stats` | ステータス別・種類別・重量・RID搭載・改造・製造区分のカウント |
| `dips_check_expiry` | N日以内に期限切れの機体一覧（更新リマインドに有用） |
| `dips_export_csv` | CSV エクスポート (UTF-8 BOM付きで Excel 即開ける) |

### コード変換 (ログイン不要)

| ツール | 機能 |
|---|---|
| `dips_lookup_code` | 国コード/都道府県コードのローカル辞書引き。code → name または name → code（部分一致） |

## 前提

1. **DRS API クライアントID + Secret を取得済み**であること（申請は最大1ヶ月）
   - 申請書: <https://www.dips-reg.mlit.go.jp/contents/drs/manual.html>
   - 提出先: `hqt-jcab.mujin@mlit.go.jp`
2. Node.js 18+
3. 申請時に登録した `redirect_uri` がローカルコールバック (`http://localhost:8765/callback` など) であること

## セットアップ

```bash
cd mcp-server
npm install
cp .env.example .env
# .env を編集して CLIENT_ID / SECRET を入れる
npm run build
```

### 環境変数

| 変数 | 必須 | 説明 |
|---|---|---|
| `DIPS_CLIENT_ID` | ✅ | 国交省から発行されたクライアントID |
| `DIPS_CLIENT_SECRET` | ✅ | クライアントシークレット |
| `DIPS_ENV` | ⚪ | `development` (検証環境) または `production`。default: development |
| `DIPS_REDIRECT_URI` | ⚪ | OAuthコールバックURL。default: `http://localhost:8765/callback` |
| `DIPS_CALLBACK_PORT` | ⚪ | コールバック用ローカルHTTPポート。default: 8765 |

## Claude Code への登録

ビルド後、Claude Code に MCP サーバーを登録する：

```bash
claude mcp add dips2 -- node /absolute/path/to/mcp-server/dist/index.js
```

または `~/.claude.json` に直接記述：

```json
{
  "mcpServers": {
    "dips2": {
      "command": "node",
      "args": ["C:/Users/hagar/workspace/work/dips2-claude-cowork-skills/mcp-server/dist/index.js"],
      "env": {
        "DIPS_CLIENT_ID": "your-client-id",
        "DIPS_CLIENT_SECRET": "your-secret",
        "DIPS_ENV": "development"
      }
    }
  }
}
```

## 使い方（Claude との対話例）

### 一覧取得

```
> 自分の登録済みドローン全部教えて
```

Claude の動き:
1. `dips_session_status` で状態確認 → 未ログインなら...
2. `dips_login` を呼び出し → ブラウザが開きDIPS-REGログイン画面
3. ログイン完了 → トークン保存
4. `dips_list_aircrafts` 呼び出し → 機体一覧を整形して表示

### 個別検索

```
> DJI Avata 360 のリモートID外付け機器の製造番号は？
```

→ `dips_get_aircraft_detail modelContains:"Avata"` で絞り込み JSON 取得

### 期限管理

```
> あと2ヶ月以内に期限切れになる機体ある？
```

→ `dips_check_expiry daysAhead:60`

### 集計

```
> 自分のドローン何機ある？種類別でも教えて
```

→ `dips_aircraft_stats`

### CSV出力

```
> 全機体をExcel用にエクスポートして
```

→ `dips_export_csv` の戻り値を保存

### コード変換（ログイン不要）

```
> 都道府県コード「13」って何？
```

→ `dips_lookup_code kind:"prefecture" code:"13"` → 「東京都」

```
> アメリカの国コードって何？
```

→ `dips_lookup_code kind:"country" name:"アメリカ"` → 「189: アメリカ合衆国」

## 重要な注意

- **アクセストークンは5分で失効**。長時間アイドル後は再ログインが必要
- **リフレッシュトークンも5分**なので、refresh_token による延長は実質使えない
- トークンはサーバープロセスのメモリ内のみに保存。プロセス再起動で消える
- 検証環境 (`DIPS_ENV=development`) で動作確認 → 国交省へ報告 → 本番クライアントID発行 → 本番運用、という流れ

## トラブルシューティング

| 状況 | 対応 |
|---|---|
| `Missing required environment variable` | `.env` または `claude mcp add` の env を確認 |
| `OAuth state mismatch` | CSRFの可能性。再実行 |
| `unauthorized_client` (400) | CLIENT_ID / CLIENT_SECRET が誤り |
| `invalid_grant` (400) | code期限切れ。再ログイン |
| `invalid_token` (401) | アクセストークン期限切れ。`dips_login` 再実行 |
| `503 E5030001` | システムメンテナンス中 |
| ブラウザが開かない | コンソールに表示されたURLを手動でブラウザに貼り付け |
| ポート8765が使用中 | `DIPS_CALLBACK_PORT` を別の番号に変更（申請時のredirect_uriと整合させる） |

## 開発

```bash
npm run dev        # tsc --watch
npm run typecheck  # 型チェックのみ
npm run start      # ビルド済みのサーバーを起動（手動テスト用）
```
