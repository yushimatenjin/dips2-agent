---
name: dips2-api
description: DRS API (ドローン登録システム / DIPS-REG) のリファレンスと実装ガイド。OpenID Connect (Keycloak) 認証フロー、機体情報一覧取得API、エラーコード、コード値変換表、MCPサーバー化の指針を含む。Use when developing integrations with dips-reg.mlit.go.jp, building OAuth flows for DRS API, implementing the dips2 MCP server, or debugging DRS API requests.
metadata:
  author: dips2-claude-cowork-skills
  version: "1.0.0"
  source: https://www.dips-reg.mlit.go.jp/contents/drs/preview/DRS_API_Guideline.pdf
  guideline_version: "1.1 (2022-12-05)"
---

# DRS API リファレンス

ドローン登録システム (DIPS-REG) が公開する読み取り専用APIの実装ガイド。OpenID Connect (Keycloak) で認証し、ユーザーが所有する無人航空機の登録情報を取得する。

> **重要**: DRS APIは**読み取り専用**。新規登録・変更・抹消はブラウザ操作 (`dips2-portal` Skill 参照) でしか行えない。

---

## 利用環境

| 環境 | ベースURL |
|---|---|
| 本番 | `https://www.dips-reg.mlit.go.jp` |
| 検証 | `https://www.dips-regdev.mlit.go.jp` |

`iss` (発行者) も環境ごとに異なるため、ID Token検証時は環境分岐必須。

---

## クライアントID取得手続き

### 標準フロー

```
[1] 申請書ダウンロード ─→ [2] 申請書記入 ─→ [3] メール提出
                                               │
                                               ↓
              [5] 動作確認 ←── [4] 検証環境クライアントID発行
                  │
                  ↓
              [6] 完了報告 ─→ [7] 本番クライアントID発行 ─→ [8] 本番運用
```

### 必要書類とリンク

| 項目 | URL |
|---|---|
| DRS API 利用申請書 | <https://www.dips-reg.mlit.go.jp/contents/drs/manual.html> |
| 利用規約 | <https://www.ossportal.dips.mlit.go.jp/contents/portal/termsDetails.html> |
| プライバシーポリシー | 同上ページに併記 |

### 提出先

- メール宛先: **`hqt-jcab.mujin@mlit.go.jp`**
- 担当: 国土交通省 航空局 安全部 無人航空機安全課 システム担当
- 提出方法: 電子メールに申請書を添付（紙提出ではない）

### 期間

| 段階 | 目安 |
|---|---|
| 申請 → 検証環境クライアントID発行 | **最大1ヶ月** |
| 動作確認 → 完了報告 | RP側の作業次第 |
| 完了報告 → 本番クライアントID発行 | 数日〜数週間 |

⚠️ **余裕を持って申請する**。事業立ち上げのクリティカルパスに乗せない。

### 申請書記入時の注意点

実際の申請書の記入欄は変わる可能性があるが、共通して聞かれる項目：

| 項目 | 注意点 |
|---|---|
| 接続システム名・概要 | 実態と乖離しないように。Claudeに連携するMCPサーバーの場合は「ローカルツールからの問い合わせ」として説明 |
| 利用目的 | 抽象的すぎず、具体的すぎず。「自社所有機体の管理ダッシュボード」「飛行計画作成支援」など |
| 取得するデータの範囲 | 必要最小限を明記。「機体情報・所有者情報・使用者情報」と書く |
| **redirect_uri** | **超重要**。本番と検証で別URLを書く。後から変更するには再申請扱い。複数のURLを登録できるか事前に確認 |
| 連絡先・担当者 | 国交省からの問い合わせに対応できる本人が望ましい |
| データ取扱責任者 | 個人情報を扱うので明記必須 |
| 利用規約への同意 | チェック欄に必ずチェック |

### redirect_uri 選定のコツ

DRS API の OAuth 認可コードを受け取るためのURL。**これがズレるとログインが破綻する**。

| 用途 | 推奨 |
|---|---|
| 個人ユース・MCPサーバーの場合 | `http://localhost:8765/callback` のようなローカルURL |
| Webアプリ提供の場合 | 本番ドメインのHTTPS URL |
| 検証環境 | 本番と別パスにする (`/callback` vs `/callback-dev` 等) |

**重要事項**:
- ポート番号も含めて完全一致が必要
- `localhost` と `127.0.0.1` も別物として扱われる場合があるので統一
- HTTPSが推奨だが、localhost ならHTTPでも可（ガイドラインの本番URL例にもHTTPあり）
- 登録した後、コードレベルで一致しないと `invalid_grant` エラー

### よくある審査差し戻し / 留意事項

過去事例や経験則から：

- **利用規約への同意欄** が空欄 → 即差し戻し
- **利用目的が曖昧** → 「データ分析のため」だけは弱い。具体的なユースケースを書く
- **redirect_uri が複数異なるドメイン** → 本番1つ・検証1つに絞る
- **データ取扱責任者が空欄** → 個人情報保護の観点で必須
- **連絡先が応答しない** → 申請却下になりうる。申請後1ヶ月はメール監視を強化
- **本番環境で性能負荷試験** をやる旨書く → 禁止事項なので確認・調整される

### 検証 → 本番 移行時の確認ポイント

DRS API設定通知書（検証用）には特定の機体IDや確認手順が書いてあるはず。それに従い：

| 確認 | 内容 |
|---|---|
| OIDC 認可リクエスト | redirect_uri へ正常にリダイレクトされ、stateが一致 |
| トークン交換 | code で access_token / id_token / refresh_token が取得できる |
| ID Token 検証 | iss / aud / exp / 署名 をすべて検証 |
| UserInfo | access_token で userinfo が取得できる |
| 機体情報一覧 | 設定通知書記載の確認ポイントに従う |
| パスワード認証 | UI で要求される |
| エラー系 | 不正codeで invalid_grant、不正アクセストークンで invalid_token |

完了したら「動作確認完了報告書」を提出 → 本番クライアントID発行を依頼。

### 機密情報の管理

`CLIENT_ID` / `CLIENT_SECRET` は外部に漏れると不正アクセスのリスク：

- ❌ Git にコミットしない（`.env` は `.gitignore` 対象）
- ❌ Slack / メール / チャット に貼らない
- ❌ ブラウザの開発者ツールに残らないようにする
- ✅ OS のキーチェーン / シークレットマネージャを使う
- ✅ 漏洩時は速やかに国交省に再発行を依頼
- ✅ MCPサーバーは標準で `process.env` から読む。`.env` は管理者のみアクセス権

### 本番運用での注意

- **本番で性能負荷試験・異常系試験は禁止**（ガイドライン明記）
- 異常系を試したいときは検証環境を使う
- 大量リクエストを送る前にレート制限を確認（ガイドラインに明記なしだが要相談）
- システムメンテナンス時間帯（公式アナウンス）は API も応答しない

---

## 認証: OpenID Connect Authorization Code Flow

Keycloak ベース。Realm名: `drs-utm`。

### エンドポイント

```
# 本番（{base} = https://www.dips-reg.mlit.go.jp）
GET  {base}/auth/realms/drs-utm/protocol/openid-connect/auth      # 認可
POST {base}/auth/realms/drs-utm/protocol/openid-connect/token     # トークン交換
GET  {base}/auth/realms/drs-utm/protocol/openid-connect/userinfo  # 属性
```

### フロー全体図

```
利用者ブラウザ              接続システム(RP)             ドローン登録システム(OP)
    |                          |                              |
    | 1. ログインボタン押下     |                              |
    |------------------------>|                              |
    |                          | 2. state生成                 |
    |                          | 3. /auth へリダイレクト       |
    |                          |     (response_type=code,     |
    |                          |      client_id, redirect_uri,|
    |                          |      scope, state)           |
    |<--------------------------------------------------------|
    | 4. ID/PW入力                                            |
    |-------------------------------------------------------->|
    |                                                          |
    |                          | 5. callback (code, state)     |
    |<-------------------------------------------------------- |
    |                          | 6. state検証                  |
    |                          | 7. POST /token                |
    |                          |    (code, client_id,          |
    |                          |     client_secret)            |
    |                          |-----------------------------> |
    |                          |<----------------------------- |
    |                          | access_token, id_token,       |
    |                          | refresh_token                 |
    |                          | 8. ID Token検証               |
    |                          | 9. GET /utm/v1/aircrafts      |
    |                          |    Authorization: Bearer ...  |
    |                          |-----------------------------> |
    |                          |<----------------------------- |
```

### 1) 認可リクエスト

| パラメータ | 必須 | 値 |
|---|---|---|
| `response_type` | ✅ | `code` 固定 |
| `client_id` | ✅ | 申請で取得 |
| `redirect_uri` | ✅ | 申請で登録したURL |
| `scope` | ✅ | `openid offline_access` 固定 |
| `state` | ✅ | CSRF対策。ランダム文字列。検証で照合 |
| `ui_locales` | ⚪ | `ja` or `en`。未指定はAccept-Language依存 |

**例**:
```
GET https://www.dips-reg.mlit.go.jp/auth/realms/drs-utm/protocol/openid-connect/auth
  ?response_type=code
  &client_id=YOUR_CLIENT_ID
  &redirect_uri=http%3A%2F%2Flocalhost%3A8765%2Fcallback
  &scope=openid+offline_access
  &state=77fFs23rt02
```

### 2) コールバック → コード受信

成功時は `redirect_uri` に以下クエリで戻る:

```
?code=...&session_state=...&state=77fFs23rt02
```

⚠️ `state` がリクエスト時の値と**一致しない場合は CSRF の可能性**。token交換しないこと。

### 3) トークン交換

```http
POST /auth/realms/drs-utm/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded;charset=UTF-8

grant_type=authorization_code
&code={受け取ったcode}
&redirect_uri={登録URL}
&client_id={CLIENT_ID}
&client_secret={CLIENT_SECRET}
```

**レスポンス (正常時)**:
```json
{
  "access_token": "eyJh...",
  "expires_in": 300,
  "refresh_expires_in": 300,
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "id_token": "eyJ...",
  "not-before-policy": 0,
  "session_state": "...",
  "scope": "openid profile offline_access"
}
```

⚠️ **アクセストークン・リフレッシュトークンとも有効期限300秒(5分)**。長時間処理向きでない。

### 4) ID Token 検証 (RP側必須)

JWT形式 (`header.payload.signature`)。以下を検証:

| 検証項目 | 内容 |
|---|---|
| `iss` | 本番: `https://www.dips-reg.mlit.go.jp/auth/realms/drs-utm` / 検証: `https://www.dips-regdev.mlit.go.jp/auth/realms/drs-utm` |
| `aud` | リクエスト時の `client_id` と一致 |
| `exp` | 現在時刻より後 |
| `iat` | 現在時刻より前で、古すぎない |
| `auth_time` | ユーザー認証時刻。古すぎない (RP判断) |
| 署名検証 | Keycloak の JWKS エンドポイントで取得した公開鍵で検証 |

JWKS: `{base}/auth/realms/drs-utm/protocol/openid-connect/certs`

### 5) UserInfo 取得 (オプション)

```http
GET /auth/realms/drs-utm/protocol/openid-connect/userinfo
Authorization: Bearer {access_token}
```

**レスポンス**:
```json
{
  "sub": "f:0ee2d184-...:18000021",
  "preferred_username": "18000021"
}
```

---

## 機体情報一覧取得 API

```http
GET /utm/v1/aircrafts
Authorization: Bearer {access_token}
```

### 取得対象

| 機体 | 取得対象 |
|---|---|
| ユーザー所有機体 | ✅ |
| 代理人として指定された機体 (ユーザー側) | ✅ |
| 他者が代理人の機体 | ❌ |
| 有効期間中 | ✅ |
| 失効後1ヶ月以内 | ✅ |
| 抹消済み | ✅ |
| 申請・審査中 (新規・変更・抹消の途中) | ❌ |

### レスポンス構造

配列で返り、各要素は `aircraft_information`, `owner_information`, `user_information` の3オブジェクトを持つ。

#### `aircraft_information` (機体情報)

| キー | 型 | 必須 | 内容 |
|---|---|---|---|
| `registration_code` | string(12) | ✅ | 国が発行する登録記号 |
| `manufacturing_number` | string(≤20) | ✅ | 製造番号 |
| `manufacturing_category` | code | ✅ | 1: メーカー製/改造機, 2: 自作 |
| `aircraft_type` | code | ✅ | 1:飛行機 2:ヘリ 3:マルチローター 4:回転翼その他 5:滑空機 6:飛行船 |
| `manufacturer_jpn` / `_eng` | string | ✅ | 製造者名 |
| `model_jpn` / `_eng` | string | ✅ | 型式名 |
| `aircraft_weight` | string(kg) | ✅ | 機体重量 |
| `weight_classification` | code | ✅ | 1: 25kg未満, 2: 25kg以上 |
| `maximum_takeoff_weight` | string(kg) | ✅ | 最大離陸重量 |
| `aircraft_width` / `_length` / `_height` | string(m) | ✅ | 機体寸法 |
| `remodeling_type` | code | ✅ | 1: 改造あり, 2: 改造なし |
| `remodeling_summary` | string | ⚪ | 改造概要 (改造ありの場合) |
| `safety_confirmation_check1〜5` | code | ⚪ | 安全性確認項目 (改造あり/自作の場合) |
| `aircraft_status` | code | ✅ | 1: 有効, 2: 期限切れ, 3: 抹消済み |
| `erase_reason_number` | code | ⚪ | 抹消理由 (1-7) |
| `erase_reason_other` | string | ⚪ | その他抹消理由 |
| `last_update_date` | datetime | ✅ | 最終更新日時 |
| `effectiveness_period_self` / `_to` | datetime | ✅ | 有効期限 自/至 |
| `rid_type` | code | ✅ | 0: なし, 1: 内蔵型, 2: 外付型 |
| `rid_manufacturer_jpn` / `_eng` | string | ⚪ | RID外付け機器の製造者 |
| `rid_model_jpn` / `_eng` | string | ⚪ | RID外付け機器の型式 |
| `rid_manufacturing_number` | string | ⚪ | RID外付け機器の製造番号 |
| `must_have_rid` | code | ✅ | 1: 搭載義務対象, 2: 対象外 |
| `modified_date` | datetime | ⚪ | RID更新日時 |
| `write_status` | code | ✅ | 0: 未書き込み, 1: 書き込み済み |

#### `owner_information` / `user_information`

両者とも同じ構造（接頭辞 `owner_` / `user_`）：

| キー | 個人 | 法人 | 内容 |
|---|---|---|---|
| `*_classification` | "1" | "2" | 区分 |
| `*_fullname` | 氏名 | 担当者氏名 | |
| `*_furigana` | フリガナ | 担当者フリガナ | |
| `*_corporation_number` | "" | 法人番号 | |
| `*_corporation_name` | "" | 企業・団体名 | |
| `*_corporation_representative_name` | "" | 代表者氏名 | |
| `*_country_code` | 別紙1 | 別紙1 | 国コード |
| `*_prefecture_code` | 別紙2 | 別紙2 | 都道府県コード |
| `*_address` | 住所 | 担当者住所 | |
| `*_headoffice_location_*` | "" | 本店所在地 | 法人のみ |
| `*_department_name` | "" | 担当者部署 | 法人のみ |
| `*_birthday` | 生年月日 | "" | 個人のみ |
| `*_country_code_tel` | 別紙1 | 別紙1 | 電話番号の国コード |
| `*_tel` | 電話番号 | 担当者電話 | |
| `*_email_address` | メール | 担当者メール | |

使用者側のみの追加項目：
- `owner_user_same_confirmation`: "1" 所有者=使用者 / "2" 別

国コード・都道府県コード変換表は同ディレクトリの `country_codes.json` / `prefecture_codes.json` を参照。

---

## エラーコード

### Authorize エンドポイント

| `error` | 説明 |
|---|---|
| `unsupported_response_type` | response_typeが不正 |

エラー時は `redirect_uri?error=...&error_description=...&state=...` の形でリダイレクト。

### Token エンドポイント

| `error` | HTTP | 説明 |
|---|---|---|
| `unauthorized_client` | 400 | client_id / client_secret が不正 |
| `invalid_request` | 400 | grant_type が不正 |
| `invalid_grant` | 400 | code が不正・期限切れ・無効、または redirect_uri 不一致 |

### UserInfo エンドポイント

| `error` | HTTP | 説明 |
|---|---|---|
| `invalid_request` | 400 | アクセストークンなし |
| `invalid_token` | 401 | アクセストークン不正・期限切れ |

### 機体情報一覧取得 API

| `error_code` | HTTP | 説明 |
|---|---|---|
| `E4000001` | 400 | パラメータエラー (json parse) |
| `E4000101` | 400 | アクセストークンからのユーザーID取得失敗 |
| `E5000002` | 500 | 内部エラー |
| `E5030001` | 503 | システムメンテナンス中 |
| (なし) | 401 | アクセストークンなし |
| (なし) | 403 | アクセストークン検証NG |

---

## 検証フロー

```
[検証環境] DRS API利用申請書提出
    ↓
[検証環境] クライアントID発行通知 + DRS API設定通知書受領
    ↓
[検証環境] 動作確認 (OAuthフロー + API取得)
    ↓
[検証環境] 動作確認完了報告
    ↓
[本番] クライアントID発行通知 + 設定通知書受領
    ↓
[本番] 動作確認 + 完了報告
```

⚠️ 本番環境での性能負荷試験・異常系試験は禁止。

---

## 確認ポイント (検証時)

| 観点 | 内容 |
|---|---|
| 認可リクエスト | ログイン成功後にredirect_uriへ戻る / state一致 |
| アクセストークン取得 | codeでaccess_token取得可能 / id_token検証OK |
| 属性取得 | access_tokenでuserinfo取得可能 |
| 認証実施 | パスワード認証が要求される |
| 機体情報API | 設定通知書記載のポイントに従う |

---

## MCP サーバー (`mcp-server/`) 提供ツール

このSkillに対応するMCPサーバーが提供する10ツール：

| MCPツール | 機能 | 内部呼び出し |
|---|---|---|
| `dips_login` | OAuth/OIDCフロー開始。ローカルコールバック + ブラウザOpen | /auth → /token |
| `dips_logout` | トークン破棄 | (ローカル) |
| `dips_session_status` | アクセストークン残り秒数 | (ローカル) |
| `dips_whoami` | 現在のログインユーザー情報 | /userinfo |
| `dips_list_aircrafts` | 機体一覧取得（filter: serial / 登録記号 / status / model / format） | GET /utm/v1/aircrafts |
| `dips_get_aircraft_detail` | 1機体の全情報をJSONで返す | (一覧から検索) |
| `dips_aircraft_stats` | ステータス別・種類別・重量別・RID別カウント、期限切れ近傍件数 | (集計) |
| `dips_check_expiry` | N日以内に期限切れ機体一覧（更新リマインドに有用） | (フィルタ) |
| `dips_export_csv` | CSV形式エクスポート (UTF-8 BOM付きでExcel互換) | (整形) |
| `dips_lookup_code` | 国コード/都道府県コードのローカル辞書引き（ログイン不要） | (ローカル) |

### MCPサーバー実装上の重要事項

1. **Token expiry が極端に短い (5分)**
   - 長時間アイドル後は再認証必須
   - リフレッシュトークンも5分なので、refresh戦略は使えない
   - 各ツール呼び出し時に `Date.now() < expiresAt` を確認し、切れていたら明示的に「再ログインが必要です」を返す

2. **ローカルコールバックサーバー**
   - `redirect_uri` は `http://localhost:8765/callback` 等で申請時に登録
   - MCPサーバー起動時に同ポートで一時的にHTTPサーバーを立てる

3. **シークレットの保存**
   - `CLIENT_ID` / `CLIENT_SECRET` は環境変数または OS keychain
   - `access_token` はメモリ（5分で切れるのでディスクに書く意味は薄い）

4. **環境分岐**
   - `DIPS_ENV=development` で `dips-regdev.mlit.go.jp` を使う
   - `iss` の検証も切り替え

5. **エラーレスポンスは Claude が読める形に整形**
   - `invalid_token` → "セッション期限切れです。`dips_login` を呼んでください"
   - `503 E5030001` → "現在メンテナンス中です"

---

## 参考リンク

- DRS APIガイドラインPDF: <https://www.dips-reg.mlit.go.jp/contents/drs/preview/DRS_API_Guideline.pdf>
- 利用申請書: <https://www.dips-reg.mlit.go.jp/contents/drs/manual.html>
- 利用規約: <https://www.ossportal.dips.mlit.go.jp/contents/portal/termsDetails.html>
- ブラウザ操作Skill: `.claude/skills/dips2-portal/SKILL.md`
- 国コード変換表: `country_codes.json`
- 都道府県コード変換表: `prefecture_codes.json`
