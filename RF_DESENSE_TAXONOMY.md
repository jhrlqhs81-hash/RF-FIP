# RF Desense Taxonomy v1

이 문서는 RF-FIP에서 감도 저하(RX sensitivity degradation, desense) 자료를 Knowledge DB와 AI 분석에 넣기 위한 구조화 기준이다.

## 목적

공개 자료와 사내 과거 사례를 단순 문서로 쌓지 않고, 실제 분석에 재사용 가능한 형태로 정리한다.

기본 흐름은 다음과 같다.

```text
원인 분류 -> 증상 패턴 -> Signature -> 확인 시험 -> 유사 사례 -> 조치 가이드
```

## 원인 대분류

| 분류 | 대표 메커니즘 | 우선 확인 |
| --- | --- | --- |
| Antenna 성능 저하 | matching detuning, efficiency 저하, hand/cover/metal effect | OTA TIS/EIS, S11, cover/fixture A/B |
| RF Conducted Path | switch/filter/duplexer/coax/C-clip 손실 증가 | Conducted RX, path loss, 부품 교체 A/B |
| Noise Figure 악화 | LNA 앞단 손실, LNA bias/gain 문제 | cascaded NF, LNA bias, filter loss |
| Internal Desense | MIPI/DDR/USB/PMIC/DCDC/display 노이즈 결합 | 기능 ON/OFF, near-field scan, shielding A/B |
| TX-induced Desense | PA noise/leakage, distortion, duplex isolation 부족 | Tx power sweep, PA Rx-band noise, channel sweep |
| Blocking/Coexistence | Wi-Fi/BT/GNSS/외부 강신호로 front-end 압박 | coexistence matrix, AGC, blocker level sweep |
| PIM/접촉 비선형 | C-clip/screw/shield/contact에서 IM 성분 생성 | 2-tone/CA, IM3/IM5 계산, 압력/torque/재조립 A/B |
| Spurious/Harmonic | clock/PA/DC-DC harmonic이 Rx channel 침범 | spectrum scan, harmonic 계산, channel dependency |
| 기구/조립 산포 | 접촉압, gap, screw torque, 낙하 후 변형 | drop 전후, torque sweep, unit/lot 분포 |
| 환경/사용 조건 | 온도, 충전, battery, grip, thermal throttling | thermal/charging/grip sweep |

## Signature Key

핵심 key는 유사사례 검색 가중치가 높다.

| Key | 목적 | 예시 |
| --- | --- | --- |
| Desense Category | 1차 원인 분류 | TX-induced PIM Desense |
| Mechanism | 물리 메커니즘 | Contact nonlinearity IM3 |
| Diagnostic Gate | 판단에 필요한 시험 관문 | Tx power sweep + pressure A/B |
| Tx Dependency | Tx 조건 의존성 | High power only |
| Conducted Result | conducted path 결과 | Normal / Fail |
| OTA Result | OTA 결과 | Fail after drop |
| CA Combo | band 조합 | B3+B7 |
| IM Product | 계산된 혼변조/고조파 | IM3 overlaps B3 DL |
| PIM Risk | PIM 가능성 | High |
| Contact Structure | 접촉 구조물 | Shield Clip |
| Antenna Path | 안테나 경로 | Antenna Feed |
| Mechanical Stress | 기구 stress | Drop / Torque |
| Thermal Sensitive | 온도 의존성 | True |

## TX-induced / PIM 판별 Flow

1. `TX off`와 `TX on`에서 RX sensitivity를 분리한다.
2. Tx power를 단계별로 sweep한다.
3. 1 carrier와 2-tone/CA 조건을 비교한다.
4. `2f1-f2`, `2f2-f1`, `3f1-2f2`, `3f2-2f1`가 RX band/channel과 겹치는지 계산한다.
5. Conducted RX와 OTA TIS/EIS를 분리한다.
6. C-clip, shield, screw, bracket, antenna feed의 압력/torque/재조립 A/B를 수행한다.
7. Drop, thermal cycle, THB 전후 결과를 비교한다.

## Knowledge DB 필수 입력

TX-induced/PIM 사례는 최소한 아래 항목을 남긴다.

| 항목 | 이유 |
| --- | --- |
| Band / Channel / RB / BW | IM 주파수 계산과 channel dependency 판단 |
| Tx Power | power dependency 확인 |
| RX fail amount dB | 감도 저하 정량화 |
| TX off baseline | TX-induced 여부 분리 |
| Conducted vs OTA | RF path와 antenna/기구 문제 분리 |
| Drop 전/후 | 접촉 변화 영향 확인 |
| Antenna route / Contact structure | high surface current 위치 추적 |
| 조치 전/후 spectrum | 원인 검증 |
| IM3/IM5 계산 결과 | causal link 확보 |

## 현재 구현 반영

- `SignaturePanel`의 추가 key 선택 목록은 이 taxonomy를 따른다.
- `similarCasesDb` 유사도 계산은 `Desense Category`, `Mechanism`, `Tx Dependency`, `PIM Risk`, `Contact Structure`, `IM Product`, `Conducted Result`, `OTA Result`를 높게 본다.
- `Knowledge DB` 상세와 `RCA Summary`는 원인 분류, 판별 시험, 조치 가이드, 의사결정 근거를 보여준다.

## Gauss/RAG 연동 시 역할

Gauss는 원문을 그대로 요약하기보다 이 taxonomy에 맞춰 다음 결과를 생성해야 한다.

- 1차 원인 분류
- Signature 후보 추출/정규화
- 누락된 필수 입력 질문
- 다음 확인 시험 추천
- 유사 사례와의 차이점 설명
- RCA 초안의 인과체인/개선조치/배운점 보강

첨부파일 원본 전송은 Gauss API와 파일 지원 스펙이 확정된 뒤 적용한다. 그 전에는 파일명, MIME type, size, 사용자가 채팅에 입력한 핵심 수치만 분석 맥락에 사용한다.
