# Evergreen (Fairstay)

*Claude가 번역했으며 원어민 검토는 아직입니다. 영문 [README](README.md)가 기준입니다.*

미국 전문 요양 시설(너싱홈) 백오피스를 위한 작은 MCP 에이전트 32개: 입소 인원, 청구, 수금, 재무, 급여, 소유권 변경. 각 에이전트는 **한 가지 일**만 맡아, 기존 시스템이 내보내는 파일을 읽고 여러분의 컴퓨터에 보고서와 초안을 씁니다.

MIT 라이선스 · Node 20 이상 · 로컬 파일만 · 자격 증명 불필요 · 가상의 테스트 데이터만

고정 가격 도입 서비스: [Fairstay](https://fair-agents.com/fairstay.html).

## 사용해 보기

```bash
npm install
npm test
node packages/oak-of-census/bin/oak-of-census.js demo
node packages/baobab-of-underwriting/bin/baobab-of-underwriting.js demo
```

각 에이전트에는 가상 파일로 실행하는 `demo`, 자체 테스트 케이스가 있는 `eval`, MCP 서버(`<agent> mcp --root <폴더>`)가 있습니다.

## 에이전트 목록

**청구와 수익 사이클:** [`oak-of-census`](packages/oak-of-census), [`birch-of-eligibility`](packages/birch-of-eligibility), [`cedar-of-payer-source`](packages/cedar-of-payer-source), [`pine-of-part-a`](packages/pine-of-part-a), [`maple-of-medicaid-pending`](packages/maple-of-medicaid-pending), [`spruce-of-liability`](packages/spruce-of-liability), [`aspen-of-part-b`](packages/aspen-of-part-b), [`hemlock-of-next-payer`](packages/hemlock-of-next-payer), [`elm-of-hospice`](packages/elm-of-hospice), [`rowan-of-crossovers`](packages/rowan-of-crossovers)

**수금과 이의 신청:** [`alder-of-collections`](packages/alder-of-collections), [`larch-of-appeals`](packages/larch-of-appeals)

**사례 관리:** [`poplar-of-authorizations`](packages/poplar-of-authorizations), [`yew-of-length-of-stay`](packages/yew-of-length-of-stay)

**관리 의료:** [`willow-of-managed-care`](packages/willow-of-managed-care), [`mulberry-of-mco-contracts`](packages/mulberry-of-mco-contracts)

**재무 서비스:** [`sequoia-of-payables`](packages/sequoia-of-payables), [`cypress-of-cash`](packages/cypress-of-cash), [`redwood-of-cashflow`](packages/redwood-of-cashflow), [`hazel-of-borrowing-base`](packages/hazel-of-borrowing-base), [`linden-of-covenants`](packages/linden-of-covenants), [`sycamore-of-close`](packages/sycamore-of-close), [`chestnut-of-cost-report`](packages/chestnut-of-cost-report), [`ash-of-ancillaries`](packages/ash-of-ancillaries), [`walnut-of-vendor-contracts`](packages/walnut-of-vendor-contracts), [`beech-of-propco`](packages/beech-of-propco)

**급여와 인력 배치:** [`holly-of-payroll`](packages/holly-of-payroll), [`magnolia-of-staffing`](packages/magnolia-of-staffing), [`acacia-of-accruals`](packages/acacia-of-accruals)

**소유권 변경과 인허가:** [`olive-of-chow`](packages/olive-of-chow), [`fir-of-licensing`](packages/fir-of-licensing)

**인수와 심사:** [`baobab-of-underwriting`](packages/baobab-of-underwriting)

## 안전을 지키는 방식

- **로컬 파일만.** 진료 소프트웨어, 지급자 포털, 은행, 행정 시스템에 로그인하지 않으며 네트워크 호출과 원격 측정도 없습니다.
- **모델이 보기 전에 마스킹.** 환자, 입소자, 직원 이름은 가명(`PT-3f9a1c2e`)이 됩니다.
- **보내는 것은 사람.** 제출, 지급, 신고, 발송은 모두 거부되며, 초안은 지정된 사람의 클릭을 기다립니다.
- **고정 규칙이 아닌 설정.** 요율, 한도, 기한은 여러분이 확인하는 JSON 설정입니다.

## 한계

법률, 세무, 청구, 의료 자문이 아닙니다. 마스킹은 설계상의 선택이며 HIPAA 판단이 아닙니다. 열 이름은 아직 실제 내보내기 파일로 검증되지 않았으며, 첫 도입 때 함께 확인합니다. 9개 언어의 파일(인코딩, 숫자, 날짜, 열 이름)을 읽으며 결과와 CSV는 영어로 유지됩니다.

## 라이선스

MIT. 자세한 내용은 영문 README를 참고하세요.
