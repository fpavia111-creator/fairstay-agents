# Fairstay (Fairstay)

*Claude による翻訳です。ネイティブスピーカーによる確認は未了です。英語の [README](README.md) が正本です。*

米国の高度看護施設（ナーシングホーム）のバックオフィス向けの小さな MCP エージェント 32 個：入居者数、請求、回収、財務、給与、所有権移転。 各エージェントは**一つの仕事**だけを担当し、既存システムがエクスポートするファイルを読み、あなたのコンピューター上にレポートと下書きを書き出します。

MIT ライセンス · Node 20 以降 · ローカルファイルのみ · 認証情報不要 · 架空のテストデータのみ

固定価格の導入サービス：[Fairstay](https://fair-agents.com/fairstay.html)。

## 試してみる

```bash
npm install
npm test
node packages/fairstay-census-billing/bin/fairstay-census-billing.js demo
node packages/fairstay-acquisition-underwriting/bin/fairstay-acquisition-underwriting.js demo
```

各エージェントには架空のファイルで動く `demo`、独自のテストケースを持つ `eval`、MCP サーバー（`<agent> mcp --root <folder>`）があります。

## エージェント一覧

**請求と収益サイクル:** [`fairstay-census-billing`](packages/fairstay-census-billing), [`fairstay-eligibility-checks`](packages/fairstay-eligibility-checks), [`fairstay-payer-source`](packages/fairstay-payer-source), [`fairstay-part-a-claims`](packages/fairstay-part-a-claims), [`fairstay-medicaid-pending`](packages/fairstay-medicaid-pending), [`fairstay-patient-liability`](packages/fairstay-patient-liability), [`fairstay-part-b-therapy`](packages/fairstay-part-b-therapy), [`fairstay-next-payer-planning`](packages/fairstay-next-payer-planning), [`fairstay-hospice-room-and-board`](packages/fairstay-hospice-room-and-board), [`fairstay-crossover-claims`](packages/fairstay-crossover-claims)

**回収と不服申立て:** [`fairstay-collections`](packages/fairstay-collections), [`fairstay-denial-appeals`](packages/fairstay-denial-appeals)

**ケース管理:** [`fairstay-managed-care-authorizations`](packages/fairstay-managed-care-authorizations), [`fairstay-length-of-stay`](packages/fairstay-length-of-stay)

**マネージドケア:** [`fairstay-managed-care-claims`](packages/fairstay-managed-care-claims), [`fairstay-mco-contracts`](packages/fairstay-mco-contracts)

**財務サービス:** [`fairstay-payables-review`](packages/fairstay-payables-review), [`fairstay-bank-reconciliation`](packages/fairstay-bank-reconciliation), [`fairstay-13-week-cash-flow`](packages/fairstay-13-week-cash-flow), [`fairstay-borrowing-base`](packages/fairstay-borrowing-base), [`fairstay-covenant-tests`](packages/fairstay-covenant-tests), [`fairstay-month-end-close`](packages/fairstay-month-end-close), [`fairstay-cost-report`](packages/fairstay-cost-report), [`fairstay-ancillary-invoices`](packages/fairstay-ancillary-invoices), [`fairstay-vendor-contracts`](packages/fairstay-vendor-contracts), [`fairstay-propco-bookkeeping`](packages/fairstay-propco-bookkeeping)

**給与と人員配置:** [`fairstay-payroll-audit`](packages/fairstay-payroll-audit), [`fairstay-staffing-and-pbj`](packages/fairstay-staffing-and-pbj), [`fairstay-payroll-accruals`](packages/fairstay-payroll-accruals)

**所有権移転と許認可:** [`fairstay-change-of-ownership`](packages/fairstay-change-of-ownership), [`fairstay-licensing-calendar`](packages/fairstay-licensing-calendar)

**買収と審査:** [`fairstay-acquisition-underwriting`](packages/fairstay-acquisition-underwriting)

## 安全に保つ仕組み

- **ローカルファイルのみ。** 診療ソフト、支払者ポータル、銀行、行政システムにはログインしません。ネットワーク通信もテレメトリもありません。
- **モデルに渡る前にマスク。** 患者・入居者・職員の氏名は仮名（`PT-3f9a1c2e`）になります。
- **送信するのは人。** 提出、支払、届出、送信はすべて拒否され、下書きは指名された人のクリックを待ちます。
- **固定ルールではなく設定。** 料率、上限、期限はあなたが確認する JSON 設定です。

## 限界

法律、税務、請求、医療に関する助言ではありません。マスキングは設計上の選択であり、HIPAA の判断ではありません。列名はまだ実際のエクスポートで検証されていません。最初の導入時に一緒に確認します。9 言語のファイル（文字コード、数値、日付、列名）を読み取れますが、結果と CSV は英語のままです。

## ライセンス

MIT。詳細は英語版 README を参照してください。
