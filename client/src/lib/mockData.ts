export type IssueStatus = 'new' | 'hypothesis' | 'validated' | 'confirmed' | 'archived';
export type MessageType = 'ai' | 'user' | 'system';
export type UserRole = 'junior' | 'senior' | 'approver';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  initials: string;
  color: string;
}

export interface SignatureTag {
  key: string;
  value: string;
  isNew?: boolean;
}

export interface PendingAliasCandidate {
  raw: string;
  canonicalKey: string;
  canonicalValue: string;
  score: number;
  matchedAlias: string;
  suggestedRelation?:
    | "synonym"
    | "alias"
    | "abbreviation"
    | "translation"
    | "spelling_variant"
    | "semantic_alias"
    | "related_to"
    | "parent_of"
    | "child_of"
    | "caused_by"
    | "measured_by"
    | "condition_of"
    | "reject";
}

export interface ChatAttachment {
  id: string;
  type: 'image' | 'table' | 'url' | 'file';
  name: string;
  url?: string;
  mimeType?: string;
  size?: number;
  rows?: string[][];
  evidence?: string[];
}

export type SummaryItem = string | {
  text: string;
  messageId?: string;
  rationale?: string;
  evidence?: string[];
};

export interface EvidenceItem {
  type: 'measurement' | 'observation' | 'rule' | 'similar_case' | 'rejected';
  label: string;
  detail: string;
  source?: string; // 출처 (예: "사용자 관찰", "Rule Engine", "KB-2023-012")
  weight: 'high' | 'medium' | 'low';
}

export type AnalysisSource = 'local-rule' | 'llm' | 'mock' | 'user-approved' | 'fallback';

export interface Hypothesis {
  id: string;
  title: string;
  confidence: number;
  mechanism: string;         // 물리적 메커니즘 설명
  reasons: { type: 'up' | 'down'; text: string }[];
  evidence: EvidenceItem[];  // 상세 근거 목록
  nextActions: string[];     // 권장 다음 조치
  status: 'active' | 'validated' | 'rejected';
  rejectedReason?: string;
  source?: AnalysisSource;
}

export interface ChatSummary {
  keyFindings: SummaryItem[];       // 핵심 발견 사항
  confirmedFacts: SummaryItem[];    // 확인된 사실
  pendingQuestions: SummaryItem[];  // 미해결 질문
  nextSteps: SummaryItem[];         // 다음 분석 단계
  lastUpdated: string;
  source?: AnalysisSource;
}

export interface Message {
  id: string;
  type: MessageType;
  userId?: string;
  content: string;
  timestamp: string;
  extractedTags?: SignatureTag[];
  pendingAliasCandidates?: PendingAliasCandidate[];
  provider?: 'local' | 'gauss' | 'openai';
  source?: AnalysisSource;
  fallbackReason?: string;
  attachments?: ChatAttachment[];
  hypotheses?: Hypothesis[];
  isTyping?: boolean;
  replyTo?: {
    id: string;
    userId?: string;
    content: string;
    timestamp: string;
  };
}

export interface Issue {
  id: string;
  title: string;
  model: string;
  status: IssueStatus;
  band: string;
  createdAt: string;
  assignee: string;
  messages: Message[];
  signatures: SignatureTag[];
  hypotheses: Hypothesis[];
  chatSummary?: ChatSummary;
}

export const USERS: Record<string, User> = {
  kim: { id: 'kim', name: '김민준', role: 'junior', initials: 'KM', color: '#60A5FA' },
};

export const MOCK_ISSUES: Issue[] = [
  {
    id: 'ISS-2024-047',
    title: 'B3 수신 감도 3dB 저하 (Display ON)',
    model: 'MODEL-A EVT2',
    status: 'hypothesis',
    band: 'LTE B3',
    createdAt: '2024-03-15',
    assignee: 'kim',
    signatures: [
      { key: 'RAT', value: 'LTE' },
      { key: 'Band', value: 'B3' },
      { key: 'Degradation', value: '3dB' },
      { key: 'Desense Category', value: 'TX-induced PIM Desense', isNew: true },
      { key: 'Mechanism', value: 'Contact nonlinearity IM3', isNew: true },
      { key: 'Diagnostic Gate', value: 'Tx power sweep + pressure A/B', isNew: true },
      { key: 'Tx Dependency', value: 'High power only', isNew: true },
      { key: 'PIM Risk', value: 'High', isNew: true },
      { key: 'Contact Structure', value: 'Shield Clip', isNew: true },
      { key: 'IM Product', value: 'IM3 overlaps B3 DL', isNew: true },
      { key: 'Conducted Result', value: 'Tx OFF normal', isNew: true },
      { key: 'OTA Result', value: 'Display ON + Tx high fail', isNew: true },
      { key: 'Trigger', value: 'Display ON', isNew: true },
      { key: 'Tx Correlated', value: 'True', isNew: true },
    ],
    chatSummary: {
      keyFindings: [
        { text: 'Display OFF 시 정상 — Display ON 시에만 3dB 저하 발생', messageId: 'm3' },
        { text: 'Tx Power 20dBm 이상에서만 증상 나타남 (임계값 확인)', messageId: 'm5' },
        { text: 'Back Cover 압력 인가 시 노이즈 출렁거림 관찰', messageId: 'm7' },
        { text: 'NF Scan: Main Board 좌측 Shield Can 모서리에서 Rx 대역 노이즈 급증', messageId: 'm10' },
        { text: '재조립 후 감도 정상 복귀 확인', messageId: 'm9' },
        '동일 Lot 10대 중 3대에서 동일 현상 — Lot 편차 이슈',
      ],
      confirmedFacts: [
        { text: 'Tx Correlated 확정 (Tx Power 20dBm 임계값)', messageId: 'm5' },
        { text: 'Pressure Sensitive 확정 (Back Cover)', messageId: 'm7' },
        { text: 'IM3 주파수 계산: 1850.5 MHz = B3 DL 대역 일치', messageId: 'm8' },
        { text: '재조립 효과 있음 → 조립 공차 문제', messageId: 'm9' },
        'Lot 편차 존재 (3/10대)',
      ],
      pendingQuestions: [
        {
          text: 'Shield Clip 변형 여부 육안 검사 필요',
          messageId: 'm10',
          rationale: 'NF scan hotspot이 Shield Can 모서리에 집중되어 접촉부 변형 여부가 Root Cause 판단에 직접 연결됩니다.',
          evidence: ['NF Scan @ Shield Can', 'Pressure Sensitive'],
        },
        {
          text: 'Torque 변경 테스트 미완료',
          messageId: 'm7',
          rationale: '압력에 따라 noise floor가 변했으므로 체결력/압축률을 독립 변수로 분리해야 합니다.',
          evidence: ['Back Cover 압력 A/B', 'Tx 20dBm 이상 악화'],
        },
        {
          text: 'Mitigation 후 재측정 데이터 필요',
          messageId: 'm11',
          rationale: '재조립 후 정상 복귀는 공정/접촉 가설을 지지하지만 설계 조치 효과를 보증하지는 않습니다.',
          evidence: ['재조립 후 정상', 'Lot 산포 3/10'],
        },
      ],
      nextSteps: [
        {
          text: 'Shield Clip 접촉력 측정 (Spring Force 계측)',
          messageId: 'm10',
          rationale: 'PIM/접촉 비선형은 접촉압과 강하게 연결되므로 정량 압력값이 있어야 개선안을 고정할 수 있습니다.',
          evidence: ['PIM Risk High', 'Shield Clip 후보'],
        },
        {
          text: 'Torque 조정 후 감도 변화 확인',
          messageId: 'm7',
          rationale: '압력 민감성이 확인된 상태라 torque sweep은 안테나 detuning과 접촉 비선형을 구분하는 가장 빠른 gate입니다.',
          evidence: ['Pressure Sensitive', 'Tx power sweep'],
        },
        {
          text: '설계 변경 후 DVT 검증 계획 수립',
          messageId: 'm12',
          rationale: 'Lot 산포가 있으므로 단일 샘플 정상화가 아니라 공정 산포를 포함한 검증 계획이 필요합니다.',
          evidence: ['Lot 3/10 재현', '재조립 효과'],
        },
      ],
      lastUpdated: '11:45',
    },
    hypotheses: [
      {
        id: 'h1',
        title: 'Shield Clip 변형에 의한 PIM',
        confidence: 78,
        mechanism: 'Shield Clip 접촉력 저하 → 금속 접촉면 산화(MIM 접합 형성) → 고전력 Tx 신호의 비선형 혼변조 → IM3 주파수가 B3 DL 대역(1850.5 MHz)에 정확히 일치하여 수신 감도 저하',
        reasons: [
          { type: 'up', text: 'Tx Power > 20dBm 임계값 (Rule Engine 일치)' },
          { type: 'up', text: 'Pressure Sensitive 확인 (Back Cover)' },
          { type: 'up', text: 'IM3 주파수 1850.5 MHz = B3 DL 중심 일치' },
          { type: 'up', text: '재조립 후 정상 복귀 (조립 공차 시사)' },
          { type: 'up', text: 'NF Scan 핫스팟 @ Shield Can 모서리' },
          { type: 'down', text: 'Drop 이력 없음 (접촉력 저하 원인 불명확)' },
          { type: 'down', text: 'Lot 편차 원인 규명 미완료' },
        ],
        evidence: [
          {
            type: 'rule',
            label: 'IM3 주파수 계산',
            detail: '2 × f_UL(1900 MHz) - f_UL2(1949.5 MHz) = 1850.5 MHz → B3 DL 중심 ±0.5 MHz 이내 일치. Rule Engine 자동 계산.',
            source: 'Rule Engine (IM Calculator)',
            weight: 'high',
          },
          {
            type: 'measurement',
            label: 'NF Scan 핫스팟 확인',
            detail: 'H-field Probe로 Main Board 좌측 Shield Can 모서리 스캔 결과 Peak -92.3 dBm @ 1850.5 MHz 검출. 인접 부위 대비 15 dB 이상 높은 수준.',
            source: 'NF_Scan_B3_MainBoard.csv (김민준, 10:15)',
            weight: 'high',
          },
          {
            type: 'observation',
            label: 'Pressure Sensitive 확인',
            detail: 'Back Cover 중앙부에 절연 막대로 압력 인가 시 Spectrum Analyzer의 Noise Floor가 ±3 dB 출렁거림. 접촉 불량에 의한 PIM의 전형적 징후.',
            source: '사용자 관찰 (09:09)',
            weight: 'high',
          },
          {
            type: 'observation',
            label: '재조립 후 정상 복귀',
            detail: '단말 완전 분해 후 재조립 시 B3 수신 감도 정상 확인. 조립 공차에 의한 Shield Clip 접촉력 저하 또는 이물질 개재 가능성 시사.',
            source: '사용자 재조립 확인 (11:30)',
            weight: 'high',
          },
          {
            type: 'similar_case',
            label: '유사 사례 KB-2023-012',
            detail: 'MODEL-A PVT에서 동일한 B3 PIM 발생. Shield Clip Spring Force 20% 증가로 해결. 현재 이슈와 Signature 유사도 82%.',
            source: 'Knowledge DB (KB-2023-012)',
            weight: 'medium',
          },
          {
            type: 'rejected',
            label: 'PMIC 노이즈 가능성 배제',
            detail: 'Tx Power 무관 테스트(Tx OFF 상태)에서 감도 저하 없음 확인. PMIC 노이즈는 Tx 상태와 무관하게 발생하므로 배제.',
            source: '김민준 엔지니어 (09:07)',
            weight: 'medium',
          },
        ],
        nextActions: [
          'Shield Clip Spring Force 계측 (목표: 50 gf 이상 확인)',
          'Torque 변경(+20%) 후 감도 재측정',
          'Lot 편차 원인 분석 (제조 공정 편차 조사)',
        ],
        status: 'active',
      },
      {
        id: 'h2',
        title: 'Display MIPI Clock Harmonic',
        confidence: 45,
        mechanism: 'Display MIPI DSI Clock(약 925 MHz)의 2차 고조파(1850 MHz)가 B3 DL 대역에 직접 침범. FPC 케이블을 통해 방사되어 Rx 대역 Noise Floor 상승.',
        reasons: [
          { type: 'up', text: 'Display ON 시에만 발생 (Display 관련 노이즈 시사)' },
          { type: 'up', text: 'MIPI Clock 2차 고조파 = 1850 MHz (B3 DL 근접)' },
          { type: 'down', text: 'Tx Power 무관 케이스 없음 (Tx Correlated 확정)' },
          { type: 'down', text: 'NF Scan에서 FPC 방사 핫스팟 미확인' },
          { type: 'down', text: 'Display OFF 테스트에서 완전 정상 (Harmonic이라면 부분 잔존해야)' },
        ],
        evidence: [
          {
            type: 'rule',
            label: 'MIPI Clock Harmonic 계산',
            detail: 'Display MIPI DSI Clock 약 925 MHz × 2 = 1850 MHz. B3 DL 중심(1842.5 MHz)과 7.5 MHz 오프셋. 완전 일치는 아니나 근접.',
            source: 'Rule Engine (Harmonic Calculator)',
            weight: 'medium',
          },
          {
            type: 'observation',
            label: 'Display ON 연동 확인',
            detail: 'Display ON/OFF 전환 시 감도 변화 재현성 100%. Display 밝기 증가 시 노이즈 레벨 약간 상승 경향 관찰.',
            source: '김민준 엔지니어 (09:03)',
            weight: 'medium',
          },
          {
            type: 'rejected',
            label: 'Tx 독립성 미확인으로 신뢰도 감소',
            detail: 'MIPI Harmonic이 원인이라면 Tx Power와 무관하게 발생해야 하나, 현재 이슈는 Tx Power 20dBm 이상에서만 발생. 순수 MIPI Harmonic 가능성 낮음.',
            source: '분석 로직',
            weight: 'high',
          },
        ],
        nextActions: [
          'Tx OFF 상태에서 Display ON/OFF 감도 비교 측정',
          'FPC 케이블 Shield Tape 임시 적용 후 효과 확인',
        ],
        status: 'active',
      },
    ],
    messages: [
      {
        id: 'm1',
        type: 'system',
        content: '이슈 ISS-2024-047이 생성되었습니다. AI Copilot이 분석을 시작합니다.',
        timestamp: '09:00',
      },
      {
        id: 'm2',
        type: 'ai',
        content: '안녕하세요. B3 수신 감도 저하 이슈를 분석하겠습니다.\n\n먼저 몇 가지 확인이 필요합니다. **Display OFF 상태에서도 동일한 감도 저하가 발생하나요?**',
        timestamp: '09:01',
      },
      {
        id: 'm3',
        type: 'user',
        userId: 'kim',
        content: 'Display OFF 시에는 정상입니다. Display ON 시에만 약 3dB 저하가 확인됩니다.',
        timestamp: '09:03',
      },
      {
        id: 'm4',
        type: 'ai',
        content: '중요한 정보 감사합니다. Display ON 시에만 발생한다는 것은 Display 관련 노이즈 또는 Tx Correlated 이슈일 가능성이 높습니다.\n\n**Tx Power를 낮췄을 때(예: 15dBm 이하)에도 동일하게 발생하나요?**',
        timestamp: '09:04',
        extractedTags: [
          { key: 'Trigger', value: 'Display ON', isNew: true },
        ],
      },
      {
        id: 'm5',
        type: 'user',
        userId: 'kim',
        content: 'Tx Power 15dBm 이하에서는 발생하지 않습니다. 약 20dBm 이상부터 나타나기 시작합니다.',
        timestamp: '09:07',
      },
      {
        id: 'm6',
        type: 'user',
        userId: 'kim',
        content: '참고로 Back Cover 부분에 압력을 가하면 노이즈가 출렁거리는 현상도 확인했습니다. PIM 가능성이 높아 보입니다.',
        timestamp: '09:09',
      },
      {
        id: 'm7',
        type: 'ai',
        content: '사용자 관찰이 매우 중요합니다. 압력 민감성과 Tx Power 임계값(20dBm)이 확인되었으므로, **PIM(Passive Intermodulation)** 가능성이 높습니다.\n\nIM3 주파수 계산 결과: **2×f_UL - f_UL2 = 1850.5 MHz** → B3 DL 대역과 일치합니다.',
        timestamp: '09:10',
        extractedTags: [
          { key: 'Tx Correlated', value: 'True', isNew: true },
          { key: 'Tx Threshold', value: '20dBm', isNew: true },
          { key: 'Pressure Sensitive', value: 'True', isNew: true },
        ],
      },
      {
        id: 'm8',
        type: 'user',
        userId: 'kim',
        content: 'Near-Field Scan 결과 Main Board 좌측 Shield Can 모서리에서 노이즈가 검출되었습니다. 측정 파일 첨부합니다.',
        timestamp: '10:15',
      },
      {
        id: 'm9',
        type: 'system',
        content: '📎 NF_Scan_B3_MainBoard.csv 업로드됨 — Peak: -92.3dBm @ 1850.5MHz',
        timestamp: '10:15',
      },
      {
        id: 'm10',
        type: 'ai',
        content: '측정 데이터 분석 완료:\n\n- **Peak 주파수**: 1850.5 MHz (B3 DL 중심 ±0.5MHz)\n- **IM3 계산값**: 1850.5 MHz ✅ 일치\n- **Shield Clip 위치**: Main Board 좌측 상단 모서리\n\n**Shield Clip 접촉력 저하에 의한 PIM**이 Root Cause로 강하게 시사됩니다. 재조립 테스트를 권장합니다.',
        timestamp: '10:16',
      },
      {
        id: 'm11',
        type: 'user',
        userId: 'kim',
        content: '재조립 테스트 완료했습니다. 재조립 후 감도 정상 확인됩니다. 조립 공차 문제로 보입니다.',
        timestamp: '11:30',
      },
      {
        id: 'm12',
        type: 'user',
        userId: 'kim',
        content: '동일 Lot 10대 추가 확인 결과 3대에서 동일 현상 확인. Lot 편차 이슈입니다. 설계 변경 필요합니다.',
        timestamp: '11:45',
      },
    ],
  },
  {
    id: 'ISS-2024-051',
    title: 'n78 PIM 발생 — 일부 단말 only',
    model: 'MODEL-B DVT1',
    status: 'validated',
    band: 'NR n78',
    createdAt: '2024-03-18',
    assignee: 'kim',
    signatures: [
      { key: 'RAT', value: 'NR' },
      { key: 'Band', value: 'n78' },
      { key: 'Unit Scope', value: 'Minority (3/10)' },
      { key: 'Reassembly', value: 'Disappears' },
      { key: 'Contact Type', value: 'Spring Contact' },
    ],
    chatSummary: {
      keyFindings: [
        '10대 중 3대에서만 발생 — Lot 편차 이슈',
        '재조립 시 증상 사라짐 — 조립 공차 원인',
        'Spring Contact 피로 의심 (접촉력 저하)',
      ],
      confirmedFacts: [
        'Unit Scope: Minority (3/10)',
        'Reassembly Effect: Disappears',
        'IM3 주파수 n78 DL 대역 일치',
      ],
      pendingQuestions: [
        {
          text: 'Spring Contact 접촉력 계측 필요',
          rationale: '재조립 후 증상이 사라지는 패턴은 접촉압/조립 산포 가능성이 높아 정량 force 확인이 필요합니다.',
          evidence: ['3/10 unit scope', 'Reassembly Effect'],
        },
      ],
      nextSteps: [
        {
          text: 'Spring Contact 재설계 검토',
          rationale: 'PIM 재발 방지를 위해 접촉압 margin을 설계값으로 올리고 공차 후에도 유지되는지 검증해야 합니다.',
          evidence: ['Spring Contact', 'IM3 overlap'],
        },
      ],
      lastUpdated: '14:20',
    },
    hypotheses: [
      {
        id: 'h3',
        title: 'Spring Contact 피로에 의한 PIM',
        confidence: 88,
        mechanism: 'Spring Contact 반복 조립/분해로 인한 스프링 피로 → 접촉력 저하 → 접촉 저항 증가 → 비선형 특성 발생 → IM3 주파수가 n78 DL 대역 침범',
        reasons: [
          { type: 'up', text: '재조립 시 사라짐 (조립 공차 시사)' },
          { type: 'up', text: 'Lot 편차 (3/10대) — 제조 편차' },
          { type: 'up', text: 'IM3 주파수 n78 DL 대역 일치' },
        ],
        evidence: [
          {
            type: 'observation',
            label: '재조립 효과 확인',
            detail: '분해 후 재조립 시 100% 정상 복귀. 조립 공차에 의한 Spring Contact 접촉력 저하가 원인임을 강하게 시사.',
            source: '사용자 관찰',
            weight: 'high',
          },
          {
            type: 'rule',
            label: 'IM3 주파수 일치',
            detail: 'n78 UL 주파수 기반 IM3 계산 결과 n78 DL 대역(3300-3400 MHz)과 일치 확인.',
            source: 'Rule Engine',
            weight: 'high',
          },
        ],
        nextActions: ['Spring Contact 재설계 (접촉력 30% 증가)'],
        status: 'validated',
      },
    ],
    messages: [],
  },
  {
    id: 'ISS-2024-038',
    title: 'B7 Harmonic Desense — CA 조합',
    model: 'MODEL-A DVT2',
    status: 'confirmed',
    band: 'LTE B7',
    createdAt: '2024-03-10',
    assignee: 'kim',
    signatures: [
      { key: 'RAT', value: 'LTE' },
      { key: 'Band', value: 'B7' },
      { key: 'CA Combo', value: 'B3+B7' },
      { key: 'IM Order', value: 'IM3' },
    ],
    chatSummary: {
      keyFindings: [
        'B3+B7 CA 조합 시에만 발생 — B3 단독 시 정상',
        'B3 UL 3차 Harmonic이 B7 DL 대역 직접 침범',
        'LPF 추가 후 완전 해결 확인',
      ],
      confirmedFacts: [
        'Root Cause 확정: B3 UL Harmonic → B7 DL',
        'Mitigation 완료: B3 PA 출력단 LPF 추가',
        'DVT2 검증 완료',
      ],
      pendingQuestions: [],
      nextSteps: [
        {
          text: 'MP 양산 적용 완료',
          rationale: 'LPF 추가 후 DVT2 검증이 완료되어 남은 작업은 양산 적용 이력 관리입니다.',
          evidence: ['LPF 효과 검증', 'DVT2 완료'],
        },
      ],
      lastUpdated: '2024-03-14',
    },
    hypotheses: [
      {
        id: 'h4',
        title: 'B3 UL 3차 Harmonic → B7 DL 침범',
        confidence: 95,
        mechanism: 'B3 UL 신호(1710-1785 MHz)의 3차 고조파(5130-5355 MHz → 실제 3차: 3×1750 = 5250 MHz)가 아닌, B3 UL 신호와 B7 UL 신호의 IM3 혼변조 산물이 B7 DL(2620-2690 MHz)에 직접 침범.',
        reasons: [
          { type: 'up', text: 'Harmonic 주파수 B7 DL 대역 완전 일치' },
          { type: 'up', text: 'B3 단독 시 B7 정상 (CA 조합 시에만 발생)' },
          { type: 'up', text: 'LPF 추가 후 완전 개선 확인' },
        ],
        evidence: [
          {
            type: 'rule',
            label: 'Harmonic 주파수 계산',
            detail: 'B3 UL(1750 MHz) × 3 = 5250 MHz → B7 DL(2655 MHz)과 직접 일치하지 않으나, IM3 계산: 2×B3_UL - B7_UL = 2×1750 - 2535 = 965 MHz (불일치). 실제는 3차 혼변조 산물.',
            source: 'Rule Engine',
            weight: 'high',
          },
          {
            type: 'measurement',
            label: 'LPF 효과 검증',
            detail: 'B3 PA 출력단에 LPF(차단주파수 2 GHz) 추가 후 B7 수신 감도 완전 정상 복귀. 개선량 5.5 dB.',
            source: '사용자 승인 기록',
            weight: 'high',
          },
        ],
        nextActions: [],
        status: 'validated',
      },
    ],
    messages: [],
  },
];
