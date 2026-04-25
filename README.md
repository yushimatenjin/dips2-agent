# dips2-claude-cowork-skills

Claude Code から **ドローン情報基盤システム2.0 (Dips 2.0 / OSSポータル)** を扱うための包括的ツール群：

- **ブラウザ操作 Skill + サブエージェント** — 飛行計画通報、飛行許可申請、機体登録などをブラウザ自動化
- **DRS API Skill** — DIPS-REG 公開APIのリファレンスとMCP実装ガイド
- **MCP サーバー** — DRS API を Claude のツールとして公開（機体一覧取得など）

> 対象システム: <https://www.ossportal.dips.mlit.go.jp/portal/top/>

## 構成

```
.claude/
├── skills/
│   ├── dips2-portal/        # ブラウザ操作スキル
│   │   └── SKILL.md
│   └── dips2-api/           # DRS APIリファレンス
│       ├── SKILL.md
│       ├── country_codes.json
│       └── prefecture_codes.json
└── agents/
    └── dips2-operator.md    # ブラウザ操作を代行するサブエージェント
mcp-server/                  # DRS API を扱う MCP サーバー (TypeScript)
├── src/
│   ├── index.ts             # MCP エントリポイント
│   ├── config.ts            # 環境設定
│   ├── auth/                # OAuth/OIDC 実装
│   │   ├── oauth.ts
│   │   └── token-store.ts
│   ├── api/                 # DRS API クライアント
│   │   ├── client.ts
│   │   ├── format.ts
│   │   └── types.ts
│   └── tools/               # MCPツール定義
│       ├── login.ts
│       ├── logout.ts
│       ├── session-status.ts
│       ├── whoami.ts
│       └── list-aircrafts.ts
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 三層アーキテクチャ

```
┌──────────────────────────────────────────────┐
│                 ユーザー                      │
└──────────────────────────────────────────────┘
              ↓ 自然言語の依頼
┌──────────────────────────────────────────────┐
│                Claude Code                    │
│  ┌──────────────┐  ┌────────────────────┐   │
│  │  Skills:      │  │  Agent:            │   │
│  │  dips2-portal│  │  dips2-operator    │   │
│  │  dips2-api   │  │  (browser auto)    │   │
│  └──────────────┘  └────────────────────┘   │
└──────────────────────────────────────────────┘
        ↓ ブラウザ操作          ↓ MCPツール呼び出し
┌─────────────────┐    ┌────────────────────┐
│ Dips 2.0 (UI)   │    │ dips2-mcp-server   │
│ ブラウザ経由     │    │ (DRS API client)   │
└─────────────────┘    └────────────────────┘
                              ↓ HTTPS + OIDC
                        ┌──────────────────┐
                        │ DRS API          │
                        │ dips-reg.mlit... │
                        └──────────────────┘
```

| 層 | 用途 | 認証 |
|---|---|---|
| Skills + Agent (ブラウザ) | 申請・通報・登録など書き込み系全般 | ユーザーが画面でログイン |
| MCP Server (API) | 機体一覧取得など読み取り系 | OAuth/OIDC（クライアントID申請必須） |

## クイックスタート

### 1. ブラウザ操作だけ使う場合

何も準備不要。Claude Code でこのディレクトリを開いて、自然な日本語で依頼するだけ：

```
明日14時に二子玉川公園でドローン飛ばすから飛行計画通報して
```

→ `dips2-operator` サブエージェントが起動して `claude-in-chrome` MCP 経由でブラウザを操作。

### 2. DRS API (MCPサーバー) を使う場合

#### 前提

- **DRS API クライアントID取得済み**（申請から発行まで最大1ヶ月）
  - 申請書: <https://www.dips-reg.mlit.go.jp/contents/drs/manual.html>
  - 提出先: `hqt-jcab.mujin@mlit.go.jp`（国交省 航空局 無人航空機安全課）
- Node.js 18+

#### セットアップ

```bash
cd mcp-server
npm install
cp .env.example .env
# .env を編集して CLIENT_ID / SECRET を設定
npm run build
```

#### Claude Code に登録

```bash
claude mcp add dips2 -- node /absolute/path/to/mcp-server/dist/index.js
```

または `~/.claude.json` に直接記述（環境変数を渡せる）：

```json
{
  "mcpServers": {
    "dips2": {
      "command": "node",
      "args": ["/path/to/dips2-claude-cowork-skills/mcp-server/dist/index.js"],
      "env": {
        "DIPS_CLIENT_ID": "...",
        "DIPS_CLIENT_SECRET": "...",
        "DIPS_ENV": "development"
      }
    }
  }
}
```

#### 使い方

```
> 自分の登録ドローン全部教えて
```

→ Claude が `dips_login` でブラウザを開いてログイン → `dips_list_aircrafts` で一覧取得

提供ツール（10種）:

| 分類 | ツール | 機能 |
|---|---|---|
| 認証 | `dips_login` | OAuth/OIDC ログイン（ブラウザ自動オープン） |
| 認証 | `dips_logout` | トークン破棄 |
| 認証 | `dips_session_status` | アクセストークン残り時間 |
| 認証 | `dips_whoami` | ログイン中ユーザー情報 |
| 機体 | `dips_list_aircrafts` | 機体一覧（製造番号・登録記号・モデル・状態でフィルタ） |
| 機体 | `dips_get_aircraft_detail` | 1機体の全情報をJSONで返す |
| 機体 | `dips_aircraft_stats` | ステータス別・種類別・RID別の集計 |
| 機体 | `dips_check_expiry` | N日以内に期限切れの機体（更新リマインド） |
| 機体 | `dips_export_csv` | CSVエクスポート（Excel互換） |
| 辞書 | `dips_lookup_code` | 国コード・都道府県コード変換（ログイン不要） |

詳細: [`mcp-server/README.md`](./mcp-server/README.md)

## ユースケース別フロー

### A. 機体登録（書き込み）

```
> DJI Avata 360 を新規登録したい
```

→ ブラウザフロー（Skill `dips2-portal` + Agent `dips2-operator`）
→ DIPS-REG にナビゲート → 6ステップを案内 → 手数料納付以降はユーザーが操作

### B. 自分の機体一覧の取得（読み取り）

```
> 自分のドローンの登録記号と製造番号一覧して
```

→ MCPフロー（Skill `dips2-api` + MCPサーバー `dips_list_aircrafts`）
→ OAuth でログイン → API取得 → 整形表示

### C. 飛行計画通報（書き込み）

```
> 明日 池袋で14時から15時 ドローン空撮 飛行計画通報
```

→ ブラウザフロー（FISS / UAFPI）

### D. 飛行許可申請ドラフト（書き込み + 文章生成）

```
> 夜間飛行の許可申請を下書きから手伝って
```

→ ブラウザフロー + Claude が文章下書き

## ユーザーレベルでの利用（任意）

このリポジトリの外でも使いたい場合：

```bash
# Skill をユーザーレベルへ
cp -r .claude/skills/dips2-portal ~/.claude/skills/
cp -r .claude/skills/dips2-api ~/.claude/skills/

# Agent をユーザーレベルへ
mkdir -p ~/.claude/agents
cp .claude/agents/dips2-operator.md ~/.claude/agents/
```

MCPサーバーは絶対パスで `claude mcp add` するので元の場所のままでOK。

## Claude が「やらないこと」

行政手続きシステムなので、以下は **必ずユーザー本人が操作** します：

| 行為 | 理由 |
|---|---|
| ログインパスワードの入力 | 認証情報の保護 |
| 新規アカウント作成 / マイナンバーカード操作 | 本人確認は本人のみ |
| 手数料納付（クレカ・口座情報） | 金銭の取り扱い |
| 最終「申請する/通報する/送信する」ボタン | 法的効力。事前に内容サマリを提示し明示承認後 |
| 規約への同意クリック | 事前に明示確認後のみ |

詳細は `.claude/skills/dips2-portal/SKILL.md` の「Claude の許可境界」を参照。

## システム上の重要な制約

Dips 2.0 公式FAQに基づく制約：

- **複数タブで同じサブシステムを開かない** — データ消失の原因
- **ブラウザの「戻る」「進む」「再読み込み」を使わない** — 必ず画面内ボタンで遷移
- **ブックマークしない** — セッションURLは再利用不可
- メンテナンス時間帯は応答しない
- **DRS API トークンは5分で失効** — 長時間処理は再認証必須

## トラブルシューティング

| 状況 | 対応 |
|---|---|
| ログインできない | パスワード再設定はユーザーがDips公式から実行 |
| メール認証が届かない | `information@dips-reg.mlit.go.jp` の迷惑メール扱いを確認 |
| エラーが連続する | エージェントは2回連続失敗で停止し、ユーザーに状況を報告 |
| メンテナンス画面 | 公式の復旧時刻まで待機 |
| MCPサーバー: `Missing env variable` | `.env` または `claude mcp add` の env を確認 |
| MCPサーバー: `invalid_token` | `dips_login` で再認証（5分でトークン失効） |
| MCPサーバー: `unauthorized_client` | クライアントID/Secretの誤り |
| その他不明点 | ヘルプデスク 03-5539-0352（平日9:00-17:00、土日祝・年末年始除く） |

## 参考

- 公式ポータル: <https://www.ossportal.dips.mlit.go.jp/portal/top/>
- マニュアル: <https://www.ossportal.dips.mlit.go.jp/portal/manual/>
- よくある質問: <https://www.ossportal.dips.mlit.go.jp/contents/portal/question.html>
- DRS API ガイドライン: <https://www.dips-reg.mlit.go.jp/contents/drs/preview/DRS_API_Guideline.pdf>
- API利用申請書: <https://www.dips-reg.mlit.go.jp/contents/drs/manual.html>
