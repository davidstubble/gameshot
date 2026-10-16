import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ActionButton, Icon, Notice, palette } from '@/components/crop/ui';
import { StudioScreen, studioStyles } from '@/components/studio/ui';

export type Template = 'utility' | 'creator' | 'agent' | 'game' | 'research';
export type Confidence = 'high' | 'assumed' | 'unvalidated';

interface TemplateConfig {
  id: Template;
  title: string;
  tagline: string;
  description: string;
  icon: 'construct-outline' | 'color-wand-outline' | 'sparkles-outline' | 'game-controller-outline' | 'analytics-outline';
  defaultRoles: { title: string; focus: string; permissions: string }[];
  primaryWorkflow: { step: string; actor: string; failureRecovery: string }[];
  systemBoundary: { client: string; backend: string; storage: string; telemetry: string };
  defaultGates: string[];
}

const TEMPLATES: Record<Template, TemplateConfig> = {
  utility: {
    id: 'utility',
    title: 'Local utility',
    tagline: 'PRIVATE ON-DEVICE PROCESSING',
    description: 'High-speed, zero-upload tools where source files and computations remain strictly local on device.',
    icon: 'construct-outline',
    defaultRoles: [
      { title: 'Local Engine Builder', focus: 'WebAssembly/Native canvas pipeline, zero-leak cache management', permissions: 'Read/write app temp sandbox; no outbound telemetry' },
      { title: 'UX & State Designer', focus: 'Drag-and-drop batch intake, live viewport geometry, non-destructive undo', permissions: 'UI state only' },
      { title: 'Validation QA', focus: 'Memory leak testing, OS clipboard format bounds, large-file stress testing', permissions: 'Automated test suite' },
      { title: 'Release Gatekeeper', focus: 'Platform sandbox compliance, offline manifest verification', permissions: 'Publishing verification' },
    ],
    primaryWorkflow: [
      { step: 'Batch File Ingestion', actor: 'User / Drag-drop', failureRecovery: 'Graceful rejection of invalid MIME types without terminating batch' },
      { step: 'Local Coordinate Mapping', actor: 'On-device UI Engine', failureRecovery: 'Snap to nearest pixel boundary when dimensions exceed viewport' },
      { step: 'Worker Process & Transformation', actor: 'Local WebWorker / Canvas', failureRecovery: 'Auto-slice memory into chunks if heap exceeds 250MB' },
      { step: 'Structured Naming & Packaging', actor: 'Export Pipeline', failureRecovery: 'Preserve user-selected sequence indices; fallback to uncompressed stream' },
    ],
    systemBoundary: {
      client: 'Progressive Web App / React Native Expo local runtime',
      backend: 'None required (stateless / pure client computation)',
      storage: 'Device file-system + IndexedDB temporary buffers (auto-cleaned on exit)',
      telemetry: 'Zero analytics or opt-in crash telemetry without payload hashing',
    },
    defaultGates: [
      'Zero remote file transmission verified via CSP network audit',
      'Memory consumption stays under 350MB during 50-file batch stress runs',
      'All temporary cache artifacts destroyed upon window unload',
      'Lossless fallback export formats provided when native canvas encoders fail',
    ],
  },
  creator: {
    id: 'creator',
    title: 'Creator app',
    tagline: 'MULTIMEDIA CONTENT STUDIO',
    description: 'Production workflows for social media, streaming assets, video thumbnails, and multi-format publications.',
    icon: 'color-wand-outline',
    defaultRoles: [
      { title: 'Asset Architect', focus: 'Multi-resolution canvas templates, aspect ratio lockstep engine', permissions: 'Asset registry read/write' },
      { title: 'Export & Conversion Lead', focus: 'DPI scaling, color profile preservation (sRGB/P3), batch packaging', permissions: 'File encoder access' },
      { title: 'Platform Reviewer', focus: 'Social platform spec compliance (TikTok 9:16, YouTube 16:9, IG 1:1)', permissions: 'Validation tools' },
      { title: 'Rights & Licensing Gate', focus: 'Font licensing validation, user-asset copyright warnings', permissions: 'Publishing review' },
    ],
    primaryWorkflow: [
      { step: 'Template & Aspect Selection', actor: 'Creator', failureRecovery: 'Maintain proportional zoom without clipping focal points' },
      { step: 'Multi-Asset Composite', actor: 'Design Engine', failureRecovery: 'Render low-res proxy during interaction; bake full-res on export' },
      { step: 'Platform Compliance Verification', actor: 'Audit Module', failureRecovery: 'Highlight out-of-bounds UI elements or clipped text overlays' },
      { step: 'Direct Export & Distribution Pack', actor: 'Packager', failureRecovery: 'Generate individual fallback files if zip creation fails' },
    ],
    systemBoundary: {
      client: 'Cross-platform canvas workstation (Mobile & Desktop Web)',
      backend: 'Optional cloud asset synchronization or headless render worker',
      storage: 'Project asset library in persistent sandbox storage',
      telemetry: 'Feature usage tracking without retaining user creative assets',
    },
    defaultGates: [
      'Preset geometry matches current 2026 platform specifications',
      'Exported images retain original color profiles without gamma degradation',
      'Sequential export names reliably preserved across external mobile galleries',
    ],
  },
  agent: {
    id: 'agent',
    title: 'Agent workflow',
    tagline: 'SUPERVISED AUTONOMOUS PIPELINE',
    description: 'Autonomous multi-step execution with explicit approval gates, tool boundaries, and structured audit trails.',
    icon: 'sparkles-outline',
    defaultRoles: [
      { title: 'Orchestrator Agent', focus: 'Decomposing complex goals into bounded, verifiable execution steps', permissions: 'Supervised plan synthesis' },
      { title: 'Tool Specialist', focus: 'Executing deterministic file, search, or API actions within schema', permissions: 'Explicit whitelist of sandboxed tools' },
      { title: 'Safety & Verification Agent', focus: 'Checking pre-conditions, detecting hallucinations, verifying outcomes', permissions: 'Approval / Denial gatekeeper' },
      { title: 'Human Operator', focus: 'Overriding decisions, approving high-impact external actions, budget control', permissions: 'Master administrative authority' },
    ],
    primaryWorkflow: [
      { step: 'Goal Ingestion & Boundary Definition', actor: 'Operator', failureRecovery: 'Request clarification before executing ambiguous objectives' },
      { step: 'Stepwise Plan Decomposition', actor: 'Orchestrator', failureRecovery: 'Regenerate plan with reduced scope if tool constraints fail' },
      { step: 'Gated Action Execution', actor: 'Tool Agent', failureRecovery: 'Pause execution and elevate to human review if output confidence < 85%' },
      { step: 'Cryptographic Audit Recording', actor: 'Safety Guard', failureRecovery: 'Immediate failsafe rollback if boundary violations occur' },
    ],
    systemBoundary: {
      client: 'Operator telemetry dashboard & real-time human intervention feed',
      backend: 'Isolated sandbox agent worker execution container',
      storage: 'Append-only immutable audit log & task checkpoint cache',
      telemetry: 'Trace recording of all prompt, tool invocation, and decision records',
    },
    defaultGates: [
      'Mandatory human confirmation for any external data mutation, payment, or transmission',
      'Strict execution timeout (max 180s per subtask) with deterministic kill switches',
      'Zero private credential sharing or plaintext token storage',
      'All agent outputs mapped to structured schemas before UI rendering',
    ],
  },
  game: {
    id: 'game',
    title: 'Game prototype',
    tagline: 'RAPID INTERACTIVE GAMEPLAY LOOP',
    description: 'Deterministic game mechanics, simulation loops, and play-money prototypes without real-cash dependencies.',
    icon: 'game-controller-outline',
    defaultRoles: [
      { title: 'Loop & Systems Designer', focus: 'Input responsiveness, physics/state step tick, balance calibration', permissions: 'Game engine code' },
      { title: 'Audio/Visual Artist', focus: 'Sprite optimization, low-latency audio cue triggering, feedback VFX', permissions: 'Asset pipeline' },
      { title: 'Balance & Economy QA', focus: 'Virtual currency flow, exploit prevention, reward curves', permissions: 'Simulation tests' },
      { title: 'Compliance Auditor', focus: 'Strict non-gambling / play-money verification, child safety filters', permissions: 'Release sign-off' },
    ],
    primaryWorkflow: [
      { step: 'Player Input Capture', actor: 'Controller Engine', failureRecovery: 'Buffered input queue to eliminate dropped frames' },
      { step: 'Fixed State Tick & Collision', actor: 'Physics Core', failureRecovery: 'Rollback to last deterministic snapshot on desync' },
      { step: 'Feedback & Visual Particle Render', actor: 'Render Loop', failureRecovery: 'Dynamic level-of-detail throttling to maintain 60 FPS' },
      { step: 'Session Score & Non-Cash Reward', actor: 'Virtual Ledger', failureRecovery: 'Local write to encrypted session storage' },
    ],
    systemBoundary: {
      client: 'WebGL / WebGPU / Canvas 2D mobile-optimized runtime',
      backend: 'High-score aggregation server or peer-to-peer WebRTC room',
      storage: 'Local high-score and unlocked cosmetics state',
      telemetry: 'Session retention & frame-rate degradation metrics',
    },
    defaultGates: [
      'Zero real-money wagering, withdrawal, or cash-convertible tokens',
      'Consistent 60 FPS performance maintained on baseline mobile hardware',
      'Accessible pause, restart, and state reset triggers accessible at all times',
    ],
  },
  research: {
    id: 'research',
    title: 'Research dashboard',
    tagline: 'EVIDENCE-FIRST SYNTHESIS MATRIX',
    description: 'Structured evidence extraction, source provenance tracking, and factual decision synthesis.',
    icon: 'analytics-outline',
    defaultRoles: [
      { title: 'Source Ingestion Specialist', focus: 'Schema normalization, URL extraction, document parsing', permissions: 'Parser access' },
      { title: 'Evidence Analyst', focus: 'Contradiction detection, numeric unit reconciliation, claim citing', permissions: 'Synthesis engine' },
      { title: 'Fact Checker', focus: 'Cross-verifying claims against primary documents; labeling assumptions', permissions: 'Verification flags' },
      { title: 'Report Formatter', focus: 'Compiling structured decision tables, markdown exports, executive briefs', permissions: 'Export generator' },
    ],
    primaryWorkflow: [
      { step: 'Multi-Source Retrieval', actor: 'Ingestion Engine', failureRecovery: 'Flag dead links and retain cached source snapshots' },
      { step: 'Claim & Citation Extraction', actor: 'Analyst Engine', failureRecovery: 'Label unverified assertions as explicit hypotheses' },
      { step: 'Contradiction & Baseline Check', actor: 'Fact Checker', failureRecovery: 'Present dissenting findings side-by-side rather than averaging' },
      { step: 'Synthesis Matrix Export', actor: 'Handoff Module', failureRecovery: 'Provide verified CSV/Markdown fallback documents' },
    ],
    systemBoundary: {
      client: 'Filterable data table and split-screen citation inspector',
      backend: 'Vector index or relational document storage',
      storage: 'Citable document archives and query caches',
      telemetry: 'Query latency and extraction confidence tracking',
    },
    defaultGates: [
      'Every factual claim linked directly to a verified source URL or citation index',
      'Explicit visual distinction between observed evidence, assumptions, and unknowns',
      'One-click export to durable Markdown and CSV files with full provenance',
    ],
  },
};

export default function FoundryScreen() {
  const [productName, setProductName] = useState('GameShot Foundry Tool');
  const [targetAudience, setTargetAudience] = useState('Competitive creators, researchers, and technical makers');
  const [coreProblem, setCoreProblem] = useState('Turning unstructured raw media and ideas into concrete, verifiable deliverables without losing data integrity.');
  const [solutionScope, setSolutionScope] = useState('A guided workspace that enforces clear scopes, role boundaries, failure fallbacks, and release gates.');
  const [template, setTemplate] = useState<Template>('utility');
  const [stage, setStage] = useState<'frame' | 'roles' | 'workflow' | 'system' | 'release'>('frame');
  const [generated, setGenerated] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Release gate states
  const [gatesChecked, setGatesChecked] = useState<Record<string, boolean>>({});

  const selected = TEMPLATES[template];

  const toggleGate = (gate: string) => {
    setGatesChecked((prev) => ({ ...prev, [gate]: !prev[gate] }));
  };

  const copyBlueprintMarkdown = async () => {
    const md = `# ${productName} — Product & Architecture Blueprint
**Generated by:** GameShot Foundry (6L Labs)
**Archetype:** ${selected.title} (${selected.tagline})

## 1. Problem & Target Audience
- **Target Audience:** ${targetAudience}
- **Core Problem:** ${coreProblem}
- **Solution Scope:** ${solutionScope}

## 2. Recommended Agent & Human Team
${selected.defaultRoles.map((r, i) => `${i + 1}. **${r.title}**\n   - *Focus:* ${r.focus}\n   - *Permission Boundary:* ${r.permissions}`).join('\n')}

## 3. Primary Execution & Failure Recovery Workflow
${selected.primaryWorkflow.map((w, i) => `${i + 1}. **${w.step}** (${w.actor})\n   - *Failure Recovery:* ${w.failureRecovery}`).join('\n')}

## 4. System Architecture & Boundaries
- **Client Surface:** ${selected.systemBoundary.client}
- **Backend / Services:** ${selected.systemBoundary.backend}
- **Data & Storage:** ${selected.systemBoundary.storage}
- **Telemetry & Privacy:** ${selected.systemBoundary.telemetry}

## 5. Required Release Gates
${selected.defaultGates.map((g, i) => `- [${gatesChecked[g] ? 'x' : ' '}] Gate ${i + 1}: ${g}`).join('\n')}

---
*Created in GameShot Foundry. Safe for local execution and team handoff.*`;

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(md);
      }
      setNotice('Complete Markdown blueprint copied to clipboard!');
    } catch {
      setNotice('Could not copy automatically. You can review the full text below.');
    }
  };

  return (
    <StudioScreen
      title="GameShot Foundry"
      subtitle="The expansive architecture factory. Transform raw concepts into verifiable specifications, role contracts, failure matrices, and release gates."
    >
      {notice ? (
        <View style={{ marginTop: 14 }}>
          <Notice message={notice} onDismiss={() => setNotice(null)} />
        </View>
      ) : null}

      {/* Hero Header */}
      <View style={styles.hero}>
        <View style={{ flex: 1, gap: 10 }}>
          <View style={styles.badgeRow}>
            <Text style={studioStyles.label}>FOUNDRY 2.0 / SPECIFICATION WORKSPACE</Text>
            <Text style={styles.studioPill}>6L LABS ARCHITECTURE</Text>
          </View>
          <Text style={styles.heroTitle}>Build with complete substance.</Text>
          <Text style={studioStyles.copy}>
            Do not settle for generic AI fluff. Foundry enforces real architectural discipline: role permissions, failure recovery paths, storage constraints, and strict release gates.
          </Text>
        </View>
        <View style={styles.mark}>
          <Icon name="cube-outline" color={palette.lime} size={32} />
          <Text style={styles.markText}>VERIFIED</Text>
          <Text style={styles.markSub}>FOUNDRY</Text>
        </View>
      </View>

      {/* Stage Selector Navigation */}
      <View style={styles.stageTabs}>
        {(
          [
            { id: 'frame', label: '1. Frame & Idea' },
            { id: 'roles', label: '2. Role Contracts' },
            { id: 'workflow', label: '3. Failure Flow' },
            { id: 'system', label: '4. System Boundaries' },
            { id: 'release', label: '5. Release Gates' },
          ] as const
        ).map((tab) => (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: stage === tab.id }}
            onPress={() => setStage(tab.id)}
            style={[styles.stageTab, stage === tab.id && styles.stageTabActive]}
          >
            <Text style={[styles.stageTabText, stage === tab.id && { color: palette.lime, fontWeight: '700' }]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* STAGE 1: Problem Framing & System Template */}
      {stage === 'frame' ? (
        <>
          <View style={studioStyles.panel}>
            <Text style={studioStyles.label}>01 / IDENTITY & AUDIENCE</Text>
            <Text style={styles.sectionTitle}>What are you building and for whom?</Text>
            
            <View style={{ gap: 6, marginTop: 4 }}>
              <Text style={styles.inputLabel}>PRODUCT OR TOOL NAME</Text>
              <TextInput
                value={productName}
                onChangeText={setProductName}
                placeholder="e.g. QuickCrop Pro, ResearchMatrix"
                placeholderTextColor={palette.muted}
                style={styles.textInput}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={styles.inputLabel}>WHO IS THIS FOR? (TARGET PERSONA)</Text>
              <TextInput
                value={targetAudience}
                onChangeText={setTargetAudience}
                placeholder="Identify the exact role or group experiencing this problem..."
                placeholderTextColor={palette.muted}
                style={styles.textInput}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={styles.inputLabel}>THE UNMET PROBLEM OR FRICTION</Text>
              <TextInput
                multiline
                value={coreProblem}
                onChangeText={setCoreProblem}
                placeholder="What breaks in their current workflow today?"
                placeholderTextColor={palette.muted}
                style={[styles.textInput, { minHeight: 75, textAlignVertical: 'top' }]}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={styles.inputLabel}>PRIMARY PROPOSED SOLUTION & SCOPE</Text>
              <TextInput
                multiline
                value={solutionScope}
                onChangeText={setSolutionScope}
                placeholder="How does this tool solve the friction cleanly in its first release?"
                placeholderTextColor={palette.muted}
                style={[styles.textInput, { minHeight: 75, textAlignVertical: 'top' }]}
              />
            </View>
          </View>

          <View style={studioStyles.panel}>
            <Text style={studioStyles.label}>02 / ARCHITECTURAL ARCHETYPE</Text>
            <Text style={styles.sectionTitle}>Select the core operating system shape</Text>
            <Text style={studioStyles.copy}>
              The archetype governs how data flows, where computations take place, and what failure paths must be secured.
            </Text>

            <View style={styles.templateList}>
              {(Object.values(TEMPLATES) as TemplateConfig[]).map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: template === item.id }}
                  onPress={() => setTemplate(item.id)}
                  style={[styles.template, template === item.id && styles.templateActive]}
                >
                  <Icon
                    name={item.icon}
                    color={template === item.id ? palette.lime : palette.muted}
                    size={24}
                  />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={[styles.templateTitle, template === item.id && { color: palette.lime }]}>
                        {item.title}
                      </Text>
                      <Text style={styles.taglinePill}>{item.tagline}</Text>
                    </View>
                    <Text style={styles.templateDescription}>{item.description}</Text>
                  </View>
                  <Icon
                    name={template === item.id ? 'checkmark-circle' : 'ellipse-outline'}
                    color={template === item.id ? palette.lime : palette.muted}
                    size={20}
                  />
                </Pressable>
              ))}
            </View>

            <ActionButton
              title="Next: Review Role Contracts"
              icon="arrow-forward"
              onPress={() => setStage('roles')}
            />
          </View>
        </>
      ) : null}

      {/* STAGE 2: Role Contracts & Permissions */}
      {stage === 'roles' ? (
        <View style={studioStyles.panel}>
          <Text style={studioStyles.label}>02 / TEAM & PERMISSION CONTRACTS</Text>
          <Text style={styles.sectionTitle}>Assigned Roles for {selected.title}</Text>
          <Text style={studioStyles.copy}>
            Every build needs bounded roles. Unbounded agents or developers create scope drift, security holes, and data leaks.
          </Text>

          <View style={{ gap: 12, marginTop: 8 }}>
            {selected.defaultRoles.map((role, idx) => (
              <View key={idx} style={styles.roleCard}>
                <View style={styles.roleHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.roleIndex}>0{idx + 1}</Text>
                    <Text style={styles.roleName}>{role.title}</Text>
                  </View>
                  <Text style={styles.roleBadge}>SUPERVISED</Text>
                </View>
                <View style={{ gap: 4, marginTop: 6 }}>
                  <Text style={styles.roleSubHeader}>CORE RESPONSIBILITY:</Text>
                  <Text style={styles.roleFocus}>{role.focus}</Text>
                </View>
                <View style={{ gap: 4, marginTop: 4 }}>
                  <Text style={styles.roleSubHeader}>PERMISSION BOUNDARY:</Text>
                  <Text style={styles.rolePerms}>{role.permissions}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <ActionButton
              title="Back"
              icon="arrow-back"
              secondary
              onPress={() => setStage('frame')}
              style={{ flex: 1 }}
            />
            <ActionButton
              title="Next: Failure Paths"
              icon="arrow-forward"
              onPress={() => setStage('workflow')}
              style={{ flex: 2 }}
            />
          </View>
        </View>
      ) : null}

      {/* STAGE 3: Workflow & Failure Recovery */}
      {stage === 'workflow' ? (
        <View style={studioStyles.panel}>
          <Text style={studioStyles.label}>03 / EXECUTION LOOP & FAILURE RECOVERY</Text>
          <Text style={styles.sectionTitle}>Deterministic Pipeline for {selected.title}</Text>
          <Text style={studioStyles.copy}>
            Systems fail at the edges. Explicit recovery mechanisms prevent data corruption, crashed tabs, and silent errors.
          </Text>

          <View style={{ gap: 12, marginTop: 8 }}>
            {selected.primaryWorkflow.map((flow, idx) => (
              <View key={idx} style={styles.flowCard}>
                <View style={styles.flowHeader}>
                  <Text style={styles.flowStepNumber}>STEP {idx + 1}</Text>
                  <Text style={styles.flowActor}>Actor: {flow.actor}</Text>
                </View>
                <Text style={styles.flowStepTitle}>{flow.step}</Text>
                <View style={styles.recoveryBox}>
                  <Icon name="shield-outline" size={16} color="#E7C77E" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recoveryLabel}>FAILURE FALLBACK & RECOVERY</Text>
                    <Text style={styles.recoveryText}>{flow.failureRecovery}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <ActionButton
              title="Back"
              icon="arrow-back"
              secondary
              onPress={() => setStage('roles')}
              style={{ flex: 1 }}
            />
            <ActionButton
              title="Next: System Boundaries"
              icon="arrow-forward"
              onPress={() => setStage('system')}
              style={{ flex: 2 }}
            />
          </View>
        </View>
      ) : null}

      {/* STAGE 4: System Architecture & Boundaries */}
      {stage === 'system' ? (
        <View style={studioStyles.panel}>
          <Text style={studioStyles.label}>04 / SYSTEM BOUNDARIES & ARCHITECTURE</Text>
          <Text style={styles.sectionTitle}>Component Topology for {selected.title}</Text>
          <Text style={studioStyles.copy}>
            Clear technical constraints for client UI, cloud dependencies, persistence, and telemetry.
          </Text>

          <View style={{ gap: 12, marginTop: 8 }}>
            <View style={styles.sysRow}>
              <View style={styles.sysIconCol}>
                <Icon name="phone-portrait-outline" size={20} color={palette.lime} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sysLabel}>CLIENT SURFACE</Text>
                <Text style={styles.sysValue}>{selected.systemBoundary.client}</Text>
              </View>
            </View>

            <View style={styles.sysRow}>
              <View style={styles.sysIconCol}>
                <Icon name="server-outline" size={20} color={palette.lime} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sysLabel}>BACKEND & SERVICES</Text>
                <Text style={styles.sysValue}>{selected.systemBoundary.backend}</Text>
              </View>
            </View>

            <View style={styles.sysRow}>
              <View style={styles.sysIconCol}>
                <Icon name="file-tray-full-outline" size={20} color={palette.lime} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sysLabel}>DATA STORAGE & PRIVACY RETENTION</Text>
                <Text style={styles.sysValue}>{selected.systemBoundary.storage}</Text>
              </View>
            </View>

            <View style={styles.sysRow}>
              <View style={styles.sysIconCol}>
                <Icon name="eye-off-outline" size={20} color={palette.lime} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sysLabel}>TELEMETRY & COMPLIANCE BOUNDARY</Text>
                <Text style={styles.sysValue}>{selected.systemBoundary.telemetry}</Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <ActionButton
              title="Back"
              icon="arrow-back"
              secondary
              onPress={() => setStage('workflow')}
              style={{ flex: 1 }}
            />
            <ActionButton
              title="Next: Release Gates"
              icon="arrow-forward"
              onPress={() => setStage('release')}
              style={{ flex: 2 }}
            />
          </View>
        </View>
      ) : null}

      {/* STAGE 5: Release Gates & Blueprint Generation */}
      {stage === 'release' ? (
        <View style={studioStyles.panel}>
          <Text style={studioStyles.label}>05 / RELEASE VERIFICATION GATES</Text>
          <Text style={styles.sectionTitle}>Mandatory Sign-off Gates</Text>
          <Text style={studioStyles.copy}>
            No product in 6L Labs or GameShot ships until its core safety and architectural gates are verified. Check off verified criteria:
          </Text>

          <View style={{ gap: 10, marginTop: 10 }}>
            {selected.defaultGates.map((gate, idx) => {
              const isChecked = !!gatesChecked[gate];
              return (
                <Pressable
                  key={idx}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isChecked }}
                  onPress={() => toggleGate(gate)}
                  style={[styles.gateRow, isChecked && styles.gateRowActive]}
                >
                  <Icon
                    name={isChecked ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={isChecked ? palette.lime : palette.muted}
                  />
                  <Text style={[styles.gateText, isChecked && { color: palette.text, fontWeight: '600' }]}>
                    {gate}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ marginTop: 14, gap: 10 }}>
            <ActionButton
              title="Generate Complete Blueprint"
              icon="document-text-outline"
              onPress={() => {
                setGenerated(true);
                setNotice('Complete architecture blueprint compiled successfully.');
              }}
            />
          </View>
        </View>
      ) : null}

      {/* GENERATED DURABLE BLUEPRINT RESULT */}
      {generated ? (
        <View style={styles.output}>
          <View style={styles.outputHeader}>
            <View style={{ gap: 4 }}>
              <Text style={studioStyles.label}>OFFICIAL BLUEPRINT READY</Text>
              <Text style={styles.outputTitle}>{productName}</Text>
              <Text style={styles.blueprintArchetype}>ARCHETYPE: {selected.title.toUpperCase()} ({selected.tagline})</Text>
            </View>
            <Text style={styles.status}>CANONICAL V1</Text>
          </View>

          <View style={styles.outputSection}>
            <Text style={styles.outputLabel}>PROBLEM FRAME</Text>
            <Text style={styles.blueprintText}>
              <Text style={{ fontWeight: '700', color: palette.text }}>Target Persona: </Text>
              {targetAudience}
            </Text>
            <Text style={styles.blueprintText}>
              <Text style={{ fontWeight: '700', color: palette.text }}>Problem: </Text>
              {coreProblem}
            </Text>
            <Text style={styles.blueprintText}>
              <Text style={{ fontWeight: '700', color: palette.text }}>Scope: </Text>
              {solutionScope}
            </Text>
          </View>

          <View style={styles.outputSection}>
            <Text style={styles.outputLabel}>AGENT & HUMAN TEAM</Text>
            {selected.defaultRoles.map((r, i) => (
              <View key={i} style={styles.bullet}>
                <Icon name="checkmark" color={palette.lime} size={15} />
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: '700', color: palette.lime }}>{r.title}: </Text>
                  {r.focus} ({r.permissions})
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.outputSection}>
            <Text style={styles.outputLabel}>PIPELINE & FAILURE RECOVERY</Text>
            {selected.primaryWorkflow.map((w, i) => (
              <View key={i} style={styles.bullet}>
                <Icon name="arrow-forward" color={palette.lime} size={14} />
                <Text style={styles.bulletText}>
                  <Text style={{ fontWeight: '700', color: palette.text }}>{w.step}</Text> [{w.actor}] → Fallback: {w.failureRecovery}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.outputSection}>
            <Text style={styles.outputLabel}>SYSTEM BOUNDARIES</Text>
            <Text style={styles.bulletText}>• Client: {selected.systemBoundary.client}</Text>
            <Text style={styles.bulletText}>• Backend: {selected.systemBoundary.backend}</Text>
            <Text style={styles.bulletText}>• Storage: {selected.systemBoundary.storage}</Text>
            <Text style={styles.bulletText}>• Telemetry: {selected.systemBoundary.telemetry}</Text>
          </View>

          <View style={styles.outputSection}>
            <Text style={styles.outputLabel}>RELEASE GATES</Text>
            {selected.defaultGates.map((g, i) => (
              <View key={i} style={styles.bullet}>
                <Icon
                  name={gatesChecked[g] ? 'checkmark-circle' : 'alert-circle-outline'}
                  color={gatesChecked[g] ? palette.lime : '#E7C77E'}
                  size={15}
                />
                <Text style={[styles.bulletText, gatesChecked[g] && { color: palette.text }]}>
                  {g} {gatesChecked[g] ? '(VERIFIED)' : '(PENDING VERIFICATION)'}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.exportBar}>
            <ActionButton
              title="Copy Markdown Spec"
              icon="copy-outline"
              onPress={copyBlueprintMarkdown}
              style={{ flex: 1 }}
            />
            <ActionButton
              title="Edit Parameters"
              icon="create-outline"
              secondary
              onPress={() => setStage('frame')}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : null}

      {/* Safety & Compliance Policy Footer */}
      <View style={styles.footer}>
        <Text style={studioStyles.label}>FOUNDRY COMPLIANCE POLICY</Text>
        <Text style={studioStyles.copy}>
          GameShot Foundry rejects unverified promises. Real-money gambling, unsupervised financial transactions, healthcare diagnosis, and unauthenticated privileged execution require manual human sign-off, external legal review, and strict security isolation before deployment.
        </Text>
      </View>
    </StudioScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: 20,
    padding: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panel,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  studioPill: {
    color: palette.lime,
    fontSize: 9,
    letterSpacing: 1.2,
    borderWidth: 1,
    borderColor: '#455B31',
    backgroundColor: palette.softLime,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontWeight: '700',
  },
  heroTitle: { color: palette.text, fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.8 },
  mark: {
    minWidth: 100,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#455B31',
    borderRadius: 14,
    backgroundColor: palette.softLime,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  markText: { color: palette.lime, fontSize: 10, letterSpacing: 1.5, fontWeight: '800' },
  markSub: { color: palette.text, fontSize: 8, letterSpacing: 1, fontWeight: '600', opacity: 0.8 },

  stageTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 20,
    paddingBottom: 4,
  },
  stageTab: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panel,
  },
  stageTabActive: {
    borderColor: palette.lime,
    backgroundColor: '#c5f76a14',
  },
  stageTabText: {
    color: palette.muted,
    fontSize: 12,
  },

  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '600' },
  inputLabel: { color: palette.muted, fontSize: 10, letterSpacing: 0.8, fontWeight: '600', marginTop: 4 },
  textInput: {
    backgroundColor: palette.bg,
    color: palette.text,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 8,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },

  templateList: { gap: 10, marginTop: 4 },
  template: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.bg,
  },
  templateActive: {
    borderColor: palette.lime,
    backgroundColor: '#c5f76a0a',
  },
  templateTitle: { color: palette.text, fontSize: 14, fontWeight: '700' },
  taglinePill: {
    color: palette.muted,
    fontSize: 8,
    letterSpacing: 0.8,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  templateDescription: { color: palette.muted, fontSize: 11, lineHeight: 16 },

  roleCard: {
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  roleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roleIndex: { color: palette.lime, fontSize: 11, fontWeight: '700' },
  roleName: { color: palette.text, fontSize: 14, fontWeight: '700' },
  roleBadge: {
    color: palette.muted,
    fontSize: 8,
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleSubHeader: { color: palette.muted, fontSize: 9, letterSpacing: 0.8, fontWeight: '600' },
  roleFocus: { color: '#D4E4CB', fontSize: 12, lineHeight: 18 },
  rolePerms: { color: palette.lime, fontSize: 11, lineHeight: 16 },

  flowCard: {
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  flowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  flowStepNumber: { color: palette.lime, fontSize: 10, letterSpacing: 1, fontWeight: '700' },
  flowActor: { color: palette.muted, fontSize: 10 },
  flowStepTitle: { color: palette.text, fontSize: 14, fontWeight: '600' },
  recoveryBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#1E1D17',
    borderWidth: 1,
    borderColor: '#4A412A',
    borderRadius: 8,
    padding: 10,
    alignItems: 'flex-start',
  },
  recoveryLabel: { color: '#E7C77E', fontSize: 9, letterSpacing: 0.8, fontWeight: '700' },
  recoveryText: { color: '#E7C77E', fontSize: 11, lineHeight: 16, marginTop: 2 },

  sysRow: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  sysIconCol: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panel,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sysLabel: { color: palette.lime, fontSize: 9, letterSpacing: 0.8, fontWeight: '700' },
  sysValue: { color: palette.text, fontSize: 12, lineHeight: 18, marginTop: 2 },

  gateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 8,
    padding: 12,
  },
  gateRowActive: {
    borderColor: palette.lime,
    backgroundColor: '#c5f76a08',
  },
  gateText: { color: palette.muted, fontSize: 12, lineHeight: 18, flex: 1 },

  output: {
    marginTop: 22,
    padding: 22,
    gap: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.lime,
    backgroundColor: '#141A13',
  },
  outputHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  outputTitle: { color: palette.text, fontSize: 24, fontWeight: '700', marginTop: 4 },
  blueprintArchetype: { color: palette.lime, fontSize: 9, letterSpacing: 1, marginTop: 2 },
  status: {
    color: palette.lime,
    fontSize: 9,
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: '#455B31',
    backgroundColor: palette.softLime,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
    fontWeight: '700',
  },
  outputSection: { gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#283623' },
  outputLabel: { color: palette.lime, fontSize: 9, letterSpacing: 1.2, fontWeight: '700' },
  blueprintText: { color: '#D4E4CB', fontSize: 12, lineHeight: 19 },
  bullet: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 2 },
  bulletText: { color: '#D4E4CB', fontSize: 12, lineHeight: 18, flex: 1 },
  exportBar: { flexDirection: 'row', gap: 12, marginTop: 12 },

  footer: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    gap: 8,
    marginBottom: 20,
  },
});
