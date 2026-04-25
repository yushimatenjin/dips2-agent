#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "./config.js";
import { LoginInputSchema, loginTool } from "./tools/login.js";
import { ListAircraftsInputSchema, listAircraftsTool } from "./tools/list-aircrafts.js";
import { GetAircraftDetailInputSchema, getAircraftDetailTool } from "./tools/get-aircraft-detail.js";
import { aircraftStatsTool } from "./tools/aircraft-stats.js";
import { CheckExpiryInputSchema, checkExpiryTool } from "./tools/check-expiry.js";
import { ExportCsvInputSchema, exportCsvTool } from "./tools/export-csv.js";
import { LookupCodeInputSchema, lookupCodeTool } from "./tools/lookup-code.js";
import { whoamiTool } from "./tools/whoami.js";
import { sessionStatusTool } from "./tools/session-status.js";
import { logoutTool } from "./tools/logout.js";

const config = loadConfig();

const server = new Server(
  { name: "dips2-mcp-server", version: "0.2.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "dips_login",
      description:
        "DIPS-REG (ドローン登録システム) にログインする。ブラウザを自動で開きOAuth/OIDCフローを実行する。完了するとアクセストークンがサーバー内に保存される。アクセストークンの有効期限は5分。",
      inputSchema: {
        type: "object",
        properties: {
          timeoutSeconds: {
            type: "number",
            description: "ログイン待機タイムアウト秒数 (default: 300)",
            minimum: 30,
            maximum: 900,
          },
        },
      },
    },
    {
      name: "dips_logout",
      description: "保存中のトークンを破棄する。",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "dips_session_status",
      description: "現在のログイン状態とアクセストークンの残り有効秒数を確認する。API呼び出し前のチェックに有用。",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "dips_whoami",
      description: "現在ログイン中のDIPS-REGユーザー情報 (sub, preferred_username) を取得する。",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "dips_list_aircrafts",
      description:
        "ユーザーが所有または代理人指定されている機体一覧を取得する。製造番号・登録記号・ステータス・モデル名でフィルタ可能。所有者・使用者情報も含む。",
      inputSchema: {
        type: "object",
        properties: {
          serial: { type: "string", description: "製造番号で絞り込み（完全一致）" },
          registrationCode: { type: "string", description: "登録記号で絞り込み（12桁完全一致）" },
          status: {
            type: "string",
            enum: ["1", "2", "3"],
            description: "機体ステータス。1: 有効, 2: 期限切れ, 3: 抹消済",
          },
          modelContains: {
            type: "string",
            description: "製造者名または型式名の部分一致（大小文字無視）",
          },
          format: {
            type: "string",
            enum: ["summary", "json"],
            description: "出力形式。summary: 整形テキスト, json: 生レスポンス。default: summary",
          },
        },
      },
    },
    {
      name: "dips_get_aircraft_detail",
      description:
        "登録記号または製造番号で1機体の全情報（aircraft + owner + user）をJSONで返す。serial か registrationCode のいずれか必須。",
      inputSchema: {
        type: "object",
        properties: {
          serial: { type: "string", description: "製造番号" },
          registrationCode: { type: "string", description: "登録記号（12桁）" },
        },
      },
    },
    {
      name: "dips_aircraft_stats",
      description:
        "全機体の集計を返す。ステータス別、機体種類別、重量区分別、リモートID搭載別、改造の有無、製造区分の各カウント、および期限切れ近傍の件数。",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "dips_check_expiry",
      description:
        "有効期限が指定日数以内に切れる機体を一覧する。更新申請のリマインドに有用。",
      inputSchema: {
        type: "object",
        properties: {
          daysAhead: {
            type: "number",
            description: "何日先までを対象にするか (default: 30)",
            minimum: 0,
            maximum: 3650,
          },
          includeExpired: {
            type: "boolean",
            description: "既に期限切れの機体も含めるか (default: true)",
          },
        },
      },
    },
    {
      name: "dips_export_csv",
      description:
        "機体一覧をCSV形式で出力する（記録保管・他システム取込用）。dips_list_aircrafts と同じフィルタが使える。default で UTF-8 BOM 付き（Excel互換）。",
      inputSchema: {
        type: "object",
        properties: {
          serial: { type: "string" },
          registrationCode: { type: "string" },
          status: { type: "string", enum: ["1", "2", "3"] },
          modelContains: { type: "string" },
          includeBom: {
            type: "boolean",
            description: "Excel互換用にUTF-8 BOMを付ける (default: true)",
          },
        },
      },
    },
    {
      name: "dips_lookup_code",
      description:
        "国コード・都道府県コードのローカル辞書引き（API呼び出し不要、ログイン不要）。code を渡すとコード→名称、name を渡すと名称→コード（部分一致）。",
      inputSchema: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["country", "prefecture"],
            description: "country: 国コード, prefecture: 都道府県コード",
          },
          code: { type: "string", description: "コード値で名称を引く" },
          name: { type: "string", description: "名称でコードを引く（部分一致）" },
        },
        required: ["kind"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  try {
    let text: string;
    switch (name) {
      case "dips_login": {
        const input = LoginInputSchema.parse(args);
        text = await loginTool(config, input);
        break;
      }
      case "dips_logout":
        text = logoutTool();
        break;
      case "dips_session_status":
        text = sessionStatusTool();
        break;
      case "dips_whoami":
        text = await whoamiTool(config);
        break;
      case "dips_list_aircrafts": {
        const input = ListAircraftsInputSchema.parse(args);
        text = await listAircraftsTool(config, input);
        break;
      }
      case "dips_get_aircraft_detail": {
        const input = GetAircraftDetailInputSchema.parse(args);
        text = await getAircraftDetailTool(config, input);
        break;
      }
      case "dips_aircraft_stats":
        text = await aircraftStatsTool(config);
        break;
      case "dips_check_expiry": {
        const input = CheckExpiryInputSchema.parse(args);
        text = await checkExpiryTool(config, input);
        break;
      }
      case "dips_export_csv": {
        const input = ExportCsvInputSchema.parse(args);
        text = await exportCsvTool(config, input);
        break;
      }
      case "dips_lookup_code": {
        const input = LookupCodeInputSchema.parse(args);
        text = lookupCodeTool(input);
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [{ type: "text", text: message }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
