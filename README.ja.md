# Evergreen (Fairstay)

*Claude による翻訳です。ネイティブスピーカーによる確認は未了です。英語の [README](README.md) が正本です。*

米国の高度看護施設（ナーシングホーム）のバックオフィス向けの小さな MCP エージェント 32 個：入居者数、請求、回収、財務、給与、所有権移転。 各エージェントは**一つの仕事**だけを担当し、既存システムがエクスポートするファイルを読み、あなたのコンピューター上にレポートと下書きを書き出します。

MIT ライセンス · Node 20 以降 · ローカルファイルのみ · 認証情報不要 · 架空のテストデータのみ

固定価格の導入サービス：[Fairstay](https://fair-agents.com/fairstay.html)。

## 試してみる

```bash
npm install
npm test
node packages/oak-of-census/bin/oak-of-census.js demo
node packages/baobab-of-underwriting/bin/baobab-of-underwriting.js demo
```

各エージェントには架空のファイルで動く `demo`、独自のテストケースを持つ `eval`、MCP サーバー（`<agent> mcp --root <folder>`）があります。

## エージェント一覧

**請求と収益サイクル:** [`oak-of-census`](packages/oak-of-census), [`birch-of-eligibility`](packages/birch-of-eligibility), [`cedar-of-payer-source`](packages/cedar-of-payer-source), [`pine-of-part-a`](packages/pine-of-part-a), [`maple-of-medicaid-pending`](packages/maple-of-medicaid-pending), [`spruce-of-liability`](packages/spruce-of-liability), [`aspen-of-part-b`](packages/aspen-of-part-b), [`hemlock-of-next-payer`](packages/hemlock-of-next-payer), [`elm-of-hospice`](packages/elm-of-hospice), [`rowan-of-crossovers`](packages/rowan-of-crossovers)

**回収と不服申立て:** [`alder-of-collections`](packages/alder-of-collections), [`larch-of-appeals`](packages/larch-of-appeals)

**ケース管理:** [`poplar-of-authorizations`](packages/poplar-of-authorizations), [`yew-of-length-of-stay`](packages/yew-of-length-of-stay)

**マネージドケア:** [`willow-of-managed-care`](packages/willow-of-managed-care), [`mulberry-of-mco-contracts`](packages/mulberry-of-mco-contracts)

**財務サービス:** [`sequoia-of-payables`](packages/sequoia-of-payables), [`cypress-of-cash`](packages/cypress-of-cash), [`redwood-of-cashflow`](packages/redwood-of-cashflow), [`hazel-of-borrowing-base`](packages/hazel-of-borrowing-base), [`linden-of-covenants`](packages/linden-of-covenants), [`sycamore-of-close`](packages/sycamore-of-close), [`chestnut-of-cost-report`](packages/chestnut-of-cost-report), [`ash-of-ancillaries`](packages/ash-of-ancillaries), [`walnut-of-vendor-contracts`](packages/walnut-of-vendor-contracts), [`beech-of-propco`](packages/beech-of-propco)

**給与と人員配置:** [`holly-of-payroll`](packages/holly-of-payroll), [`magnolia-of-staffing`](packages/magnolia-of-staffing), [`acacia-of-accruals`](packages/acacia-of-accruals)

**所有権移転と許認可:** [`olive-of-chow`](packages/olive-of-chow), [`fir-of-licensing`](packages/fir-of-licensing)

**買収と審査:** [`baobab-of-underwriting`](packages/baobab-of-underwriting)

## 安全に保つ仕組み

- **ローカルファイルのみ。** 診療ソフト、支払者ポータル、銀行、行政システムにはログインしません。ネットワーク通信もテレメトリもありません。
- **モデルに渡る前にマスク。** 患者・入居者・職員の氏名は仮名（`PT-3f9a1c2e`）になります。
- **送信するのは人。** 提出、支払、届出、送信はすべて拒否され、下書きは指名された人のクリックを待ちます。
- **固定ルールではなく設定。** 料率、上限、期限はあなたが確認する JSON 設定です。

## 限界

法律、税務、請求、医療に関する助言ではありません。マスキングは設計上の選択であり、HIPAA の判断ではありません。列名はまだ実際のエクスポートで検証されていません。最初の導入時に一緒に確認します。9 言語のファイル（文字コード、数値、日付、列名）を読み取れますが、結果と CSV は英語のままです。

## ライセンス

MIT。詳細は英語版 README を参照してください。
