# RF Failure Intelligence Platform — UX 디자인 아이디어

## 핵심 UX 시나리오
1. 이슈 생성 및 다중 사용자 협업 채팅
2. AI가 Narrowing 인터뷰 진행 (중간에 엔지니어들이 코멘트 추가)
3. Signature 자동 추출 및 가설 제안 (Confidence Score + 근거)
4. 이슈 해결 후 RCA Summary 자동 생성
5. 시니어 엔지니어의 DB 컨펌 (1-Click 승인/반려)

---

<response>
<text>
**Design Movement**: Technical Precision meets Human Collaboration — "Engineering War Room"
**Core Principles**:
- 정보 밀도 우선: 엔지니어는 데이터를 빠르게 스캔해야 함
- 역할 구분 명시: AI 메시지, 사용자 메시지, 시스템 이벤트를 시각적으로 명확히 분리
- 상태 투명성: 이슈의 현재 상태(Hypothesis → Validated → Confirmed)를 항상 노출
- 협업 컨텍스트: 누가 무엇을 언제 기여했는지 추적 가능

**Color Philosophy**:
- 배경: 딥 네이비 (#0D1117) — 장시간 작업에 적합한 다크 테마
- 주조색: 전기 블루 (#2563EB) — AI 메시지 및 주요 액션
- 강조색: 앰버 (#F59E0B) — 경고, 가설 상태
- 성공색: 에메랄드 (#10B981) — 확정 원인, 승인 완료
- 위험색: 로즈 (#F43F5E) — 오진, 반려

**Layout Paradigm**:
- 3-Panel 레이아웃: 좌측 이슈 목록 | 중앙 채팅 + AI 인터뷰 | 우측 Signature/가설 패널
- 우측 패널은 채팅 진행에 따라 실시간 업데이트

**Signature Elements**:
- AI 메시지: 왼쪽 정렬, 파란 아이콘 + "AI Copilot" 레이블
- 사용자 메시지: 역할(Junior/Senior) 배지 + 아바타
- 상태 타임라인: 우측 패널 상단에 이슈 상태 진행 바

**Interaction Philosophy**:
- 승인 플로우: 큰 초록 "Approve" 버튼 + 반려 이유 입력 모달
- Signature 태그: 채팅에서 자동 추출된 태그를 클릭하면 편집 가능

**Animation**:
- AI 타이핑 인디케이터: 점 3개 애니메이션
- 새 메시지: 아래에서 슬라이드 업
- 상태 전환: 배지 색상 크로스페이드

**Typography System**:
- 헤더: JetBrains Mono (기술적 느낌)
- 본문: Inter
- 코드/수치: JetBrains Mono
</text>
<probability>0.08</probability>
</response>

<response>
<text>
**Design Movement**: Clean Professional — "Diagnostic Dashboard"
**Core Principles**:
- 라이트 테마, 높은 가독성
- 카드 기반 정보 구조
- 진행 상태 시각화 중심

**Color Philosophy**:
- 배경: 슬레이트 화이트 (#F8FAFC)
- 주조색: 인디고 (#4F46E5)
- 강조: 오렌지 (#EA580C)

**Layout Paradigm**:
- 상단 이슈 헤더 + 하단 2-Panel (채팅 | 분석 패널)
</text>
<probability>0.05</probability>
</response>

<response>
<text>
**Design Movement**: Minimal Functional — "Slack-like Collaboration"
**Core Principles**:
- 채팅 중심 UX, 사이드바 채널 구조
- 스레드 기반 대화

**Color Philosophy**:
- 퍼플 사이드바 + 화이트 메인
</text>
<probability>0.04</probability>
</response>

## 선택: Design 1 — "Engineering War Room" (딥 네이비 다크 테마)
