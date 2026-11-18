# Fairstay (Fairstay)

*Claude가 번역했으며 원어민 검토는 아직입니다. 영문 [README](README.md)가 기준입니다.*

미국 전문 요양 시설(너싱홈) 백오피스를 위한 작은 MCP 에이전트 32개: 입소 인원, 청구, 수금, 재무, 급여, 소유권 변경. 각 에이전트는 **한 가지 일**만 맡아, 기존 시스템이 내보내는 파일을 읽고 여러분의 컴퓨터에 보고서와 초안을 씁니다.

MIT 라이선스 · Node 20 이상 · 로컬 파일만 · 자격 증명 불필요 · 가상의 테스트 데이터만

고정 가격 도입 서비스: [Fairstay](https://fair-agents.com/fairstay.html).

## 사용해 보기

```bash
npm install
npm test
node packages/fairstay-census-billing/bin/fairstay-census-billing.js demo
node packages/fairstay-acquisition-underwriting/bin/fairstay-acquisition-underwriting.js demo
```

각 에이전트에는 가상 파일로 실행하는 `demo`, 자체 테스트 케이스가 있는 `eval`, MCP 서버(`<agent> mcp --root <폴더>`)가 있습니다.

## 에이전트 목록

**청구와 수익 사이클:** [`fairstay-census-billing`](packages/fairstay-census-billing), [`fairstay-eligibility-checks`](packages/fairstay-eligibility-checks), [`fairstay-payer-source`](packages/fairstay-payer-source), [`fairstay-part-a-claims`](packages/fairstay-part-a-claims), [`fairstay-medicaid-pending`](packages/fairstay-medicaid-pending), [`fairstay-patient-liability`](packages/fairstay-patient-liability), [`fairstay-part-b-therapy`](packages/fairstay-part-b-therapy), [`fairstay-next-payer-planning`](packages/fairstay-next-payer-planning), [`fairstay-hospice-room-and-board`](packages/fairstay-hospice-room-and-board), [`fairstay-crossover-claims`](packages/fairstay-crossover-claims)

**수금과 이의 신청:** [`fairstay-collections`](packages/fairstay-collections), [`fairstay-denial-appeals`](packages/fairstay-denial-appeals)

**사례 관리:** [`fairstay-managed-care-authorizations`](packages/fairstay-managed-care-authorizations), [`fairstay-length-of-stay`](packages/fairstay-length-of-stay)

**관리 의료:** [`fairstay-managed-care-claims`](packages/fairstay-managed-care-claims), [`fairstay-mco-contracts`](packages/fairstay-mco-contracts)

**재무 서비스:** [`fairstay-payables-review`](packages/fairstay-payables-review), [`fairstay-bank-reconciliation`](packages/fairstay-bank-reconciliation), [`fairstay-13-week-cash-flow`](packages/fairstay-13-week-cash-flow), [`fairstay-borrowing-base`](packages/fairstay-borrowing-base), [`fairstay-covenant-tests`](packages/fairstay-covenant-tests), [`fairstay-month-end-close`](packages/fairstay-month-end-close), [`fairstay-cost-report`](packages/fairstay-cost-report), [`fairstay-ancillary-invoices`](packages/fairstay-ancillary-invoices), [`fairstay-vendor-contracts`](packages/fairstay-vendor-contracts), [`fairstay-propco-bookkeeping`](packages/fairstay-propco-bookkeeping)

**급여와 인력 배치:** [`fairstay-payroll-audit`](packages/fairstay-payroll-audit), [`fairstay-staffing-and-pbj`](packages/fairstay-staffing-and-pbj), [`fairstay-payroll-accruals`](packages/fairstay-payroll-accruals)

**소유권 변경과 인허가:** [`fairstay-change-of-ownership`](packages/fairstay-change-of-ownership), [`fairstay-licensing-calendar`](packages/fairstay-licensing-calendar)

**인수와 심사:** [`fairstay-acquisition-underwriting`](packages/fairstay-acquisition-underwriting)

## 안전을 지키는 방식

- **로컬 파일만.** 진료 소프트웨어, 지급자 포털, 은행, 행정 시스템에 로그인하지 않으며 네트워크 호출과 원격 측정도 없습니다.
- **모델이 보기 전에 마스킹.** 환자, 입소자, 직원 이름은 가명(`PT-3f9a1c2e`)이 됩니다.
- **보내는 것은 사람.** 제출, 지급, 신고, 발송은 모두 거부되며, 초안은 지정된 사람의 클릭을 기다립니다.
- **고정 규칙이 아닌 설정.** 요율, 한도, 기한은 여러분이 확인하는 JSON 설정입니다.

## 한계

법률, 세무, 청구, 의료 자문이 아닙니다. 마스킹은 설계상의 선택이며 HIPAA 판단이 아닙니다. 열 이름은 아직 실제 내보내기 파일로 검증되지 않았으며, 첫 도입 때 함께 확인합니다. 9개 언어의 파일(인코딩, 숫자, 날짜, 열 이름)을 읽으며 결과와 CSV는 영어로 유지됩니다.

## 라이선스

MIT. 자세한 내용은 영문 README를 참고하세요.
