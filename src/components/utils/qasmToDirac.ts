/**
 * qasmToDirac.ts
 *
 * Transformiert einen OpenQASM 3 / OpenQASM 2 String in Dirac-Notation (Bra-Ket).
 *
 * Ansatz: symbolischer Statevector-Simulator auf Basis der Gate-Sequenz.
 * Unterstützte Gates: H, X, Y, Z, S, T, CNOT (CX), CZ, SWAP, RZ, RX, RY, U1, U2, U3, Measure.
 *
 * Ausgabe-Beispiel für 2 Qubits nach H auf q[0]:
 *   1/√2 |00⟩ + 1/√2 |10⟩
 */

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export interface Complex {
  re: number;
  im: number;
}

export interface DiracTerm {
  amplitude: Complex;
  basisState: string; // z. B. "00", "101"
}

export interface DiracResult {
  terms: DiracTerm[];           // Alle Terme mit |amplitude|² > THRESHOLD
  latex: string;                // LaTeX-String der Superposition
  unicode: string;              // Unicode-String mit ⟨ ⟩ Klammern
  numQubits: number;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen für komplexe Zahlen
// ---------------------------------------------------------------------------

const C = (re: number, im = 0): Complex => ({ re, im });

function cadd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function cmul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

function cabs2(a: Complex): number {
  return a.re * a.re + a.im * a.im;
}

function cscale(a: Complex, s: number): Complex {
  return { re: a.re * s, im: a.im * s };
}

const SQRT2_INV = 1 / Math.sqrt(2);

// ---------------------------------------------------------------------------
// Statevector
// ---------------------------------------------------------------------------

function createStatevector(n: number): Complex[] {
  const size = 1 << n;
  const sv: Complex[] = Array.from({ length: size }, () => C(0));
  sv[0] = C(1); // |000...0⟩
  return sv;
}

/** Wendet eine 2×2-Einzel-Qubit-Matrix auf Qubit `target` an. */
function applySingleQubitGate(
  sv: Complex[],
  n: number,
  target: number,
  m: [Complex, Complex, Complex, Complex] // [m00, m01, m10, m11]
): Complex[] {
  const size = sv.length;
  const result = sv.slice();
  const bit = n - 1 - target; // MSB-first ordering matching QASM convention

  for (let i = 0; i < size; i++) {
    if (i & (1 << bit)) continue; // nur einmal pro Paar
    const j = i | (1 << bit);
    const a = sv[i];
    const b = sv[j];
    result[i] = cadd(cmul(m[0], a), cmul(m[1], b));
    result[j] = cadd(cmul(m[2], a), cmul(m[3], b));
  }
  return result;
}

/** Controlled-Unitary: Gate wird auf `target` angewendet wenn `control` = 1. */
function applyControlledGate(
  sv: Complex[],
  n: number,
  control: number,
  target: number,
  m: [Complex, Complex, Complex, Complex]
): Complex[] {
  const size = sv.length;
  const result = sv.slice();
  const cBit = n - 1 - control;
  const tBit = n - 1 - target;

  for (let i = 0; i < size; i++) {
    if (!(i & (1 << cBit))) continue; // Control muss 1 sein
    if (i & (1 << tBit)) continue;    // nur einmal pro Paar
    const j = i | (1 << tBit);
    const a = sv[i];
    const b = sv[j];
    result[i] = cadd(cmul(m[0], a), cmul(m[1], b));
    result[j] = cadd(cmul(m[2], a), cmul(m[3], b));
  }
  return result;
}

/** SWAP zweier Qubits */
function applySwap(
  sv: Complex[],
  n: number,
  q1: number,
  q2: number
): Complex[] {
  const result = sv.slice();
  const b1 = n - 1 - q1;
  const b2 = n - 1 - q2;
  const size = sv.length;
  for (let i = 0; i < size; i++) {
    const bit1 = (i >> b1) & 1;
    const bit2 = (i >> b2) & 1;
    if (bit1 !== bit2) {
      const j = i ^ (1 << b1) ^ (1 << b2);
      if (j > i) {
        [result[i], result[j]] = [result[j], result[i]];
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Gate-Matrizen
// ---------------------------------------------------------------------------

const GATE_H: [Complex, Complex, Complex, Complex] = [
  C(SQRT2_INV), C(SQRT2_INV), C(SQRT2_INV), C(-SQRT2_INV),
];
const GATE_X: [Complex, Complex, Complex, Complex] = [
  C(0), C(1), C(1), C(0),
];
const GATE_Y: [Complex, Complex, Complex, Complex] = [
  C(0), C(0, -1), C(0, 1), C(0),
];
const GATE_Z: [Complex, Complex, Complex, Complex] = [
  C(1), C(0), C(0), C(-1),
];
const GATE_S: [Complex, Complex, Complex, Complex] = [
  C(1), C(0), C(0), C(0, 1),
];
const GATE_T: [Complex, Complex, Complex, Complex] = [
  C(1), C(0), C(0), C(Math.cos(Math.PI / 4), Math.sin(Math.PI / 4)),
];
const GATE_SDG: [Complex, Complex, Complex, Complex] = [
  C(1), C(0), C(0), C(0, -1),
];
const GATE_TDG: [Complex, Complex, Complex, Complex] = [
  C(1), C(0), C(0), C(Math.cos(Math.PI / 4), -Math.sin(Math.PI / 4)),
];

function gateRZ(theta: number): [Complex, Complex, Complex, Complex] {
  return [
    C(Math.cos(theta / 2), -Math.sin(theta / 2)),
    C(0),
    C(0),
    C(Math.cos(theta / 2), Math.sin(theta / 2)),
  ];
}
function gateRX(theta: number): [Complex, Complex, Complex, Complex] {
  return [
    C(Math.cos(theta / 2)), C(0, -Math.sin(theta / 2)),
    C(0, -Math.sin(theta / 2)), C(Math.cos(theta / 2)),
  ];
}
function gateRY(theta: number): [Complex, Complex, Complex, Complex] {
  return [
    C(Math.cos(theta / 2)), C(-Math.sin(theta / 2)),
    C(Math.sin(theta / 2)), C(Math.cos(theta / 2)),
  ];
}
function gateU3(theta: number, phi: number, lam: number): [Complex, Complex, Complex, Complex] {
  return [
    C(Math.cos(theta / 2)),
    C(-Math.cos(lam) * Math.sin(theta / 2), -Math.sin(lam) * Math.sin(theta / 2)),
    C(Math.cos(phi) * Math.sin(theta / 2), Math.sin(phi) * Math.sin(theta / 2)),
    C(
      Math.cos(phi + lam) * Math.cos(theta / 2),
      Math.sin(phi + lam) * Math.cos(theta / 2)
    ),
  ];
}

// SX = √X Gate: 0.5 * [[1+i, 1-i], [1-i, 1+i]]
const GATE_SX: [Complex, Complex, Complex, Complex] = [
  C(0.5, 0.5), C(0.5, -0.5),
  C(0.5, -0.5), C(0.5, 0.5),
];

// CP(λ): Controlled-Phase – |11⟩ bekommt Phase e^(iλ)
function gateCPMatrix(lam: number): [Complex, Complex, Complex, Complex] {
  return [C(1), C(0), C(0), C(Math.cos(lam), Math.sin(lam))];
}

// CU(θ,φ,λ,γ): Controlled-U mit globalem Phasenfaktor γ
function gateCUMatrix(
  theta: number, phi: number, lam: number, gamma: number
): [Complex, Complex, Complex, Complex] {
  const phase = (a: number) => C(Math.cos(a), Math.sin(a));
  return [
    cmul(phase(gamma), C(Math.cos(theta / 2))),
    cmul(phase(gamma), C(-Math.cos(lam) * Math.sin(theta / 2), -Math.sin(lam) * Math.sin(theta / 2))),
    cmul(phase(gamma), C(Math.cos(phi) * Math.sin(theta / 2), Math.sin(phi) * Math.sin(theta / 2))),
    cmul(phase(gamma), C(Math.cos(phi + lam) * Math.cos(theta / 2), Math.sin(phi + lam) * Math.cos(theta / 2))),
  ];
}

/** Toffoli (CCX): X auf target wenn c1=1 und c2=1 */
function applyToffoli(
  sv: Complex[], n: number, c1: number, c2: number, target: number
): Complex[] {
  const result = sv.slice();
  const b1 = n - 1 - c1;
  const b2 = n - 1 - c2;
  const bt = n - 1 - target;
  for (let i = 0; i < sv.length; i++) {
    if (!(i & (1 << b1))) continue;
    if (!(i & (1 << b2))) continue;
    if (i & (1 << bt))    continue;
    const j = i | (1 << bt);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** CSWAP (Fredkin): Swap t1↔t2 wenn ctrl=1 */
function applyCSwap(
  sv: Complex[], n: number, ctrl: number, t1: number, t2: number
): Complex[] {
  const result = sv.slice();
  const bc = n - 1 - ctrl;
  const b1 = n - 1 - t1;
  const b2 = n - 1 - t2;
  for (let i = 0; i < sv.length; i++) {
    if (!(i & (1 << bc))) continue;
    const bit1 = (i >> b1) & 1;
    const bit2 = (i >> b2) & 1;
    if (bit1 === bit2) continue;
    const j = i ^ (1 << b1) ^ (1 << b2);
    if (j > i) [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ---------------------------------------------------------------------------
// QASM-Parser
// ---------------------------------------------------------------------------

interface ParsedGate {
  name: string;
  qubits: number[];   // Qubit-Indizes (global, aufgelöst)
  params: number[];   // Numerische Parameter
}

/** Einfacher Ausdruck-Evaluator für QASM-Parameter (pi, *, /, +, -) */
function evalParam(expr: string): number {
  // ersetze "pi" durch Math.PI
  const sanitized = expr.trim().replace(/\bpi\b/gi, String(Math.PI));
  try {
    // eslint-disable-next-line no-new-func
    return Function('"use strict"; return (' + sanitized + ')')() as number;
  } catch {
    return 0;
  }
}

export function parseQasm(qasm: string): {
  numQubits: number;
  gates: ParsedGate[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const lines = qasm
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, '').trim())
    .filter(l => l.length > 0);

  // Qubit-Register aufbauen: Name → { start, size }
  const registers: Map<string, { start: number; size: number }> = new Map();
  let totalQubits = 0;

  // ---------------------------------------------------------------------------
  // LEQO-Alias-Tabelle: Alias-Name → globaler Qubit-Index
  // Beispiel: "let leqo_abc_q0 = leqo_reg[{0}];"
  //        → aliasMap.set("leqo_abc_q0", 0)
  // ---------------------------------------------------------------------------
  const aliasMap: Map<string, number> = new Map();

  // LEQO-Array-Alias: Alias-Name → [idx0, idx1, ...]
  // Beispiel: "let leqo_abc = leqo_reg[{0, 1}];"
  //        → aliasArrayMap.set("leqo_abc", [0, 1])
  const aliasArrayMap: Map<string, number[]> = new Map();

  // ---------------------------------------------------------------------------
  // Erster Pass: Register + LEQO-Aliasse sammeln
  // ---------------------------------------------------------------------------
  for (const line of lines) {
    // OPENQASM 2: qreg q[3];
    const qreg2 = line.match(/^qreg\s+(\w+)\s*\[(\d+)\]/);
    if (qreg2) {
      registers.set(qreg2[1], { start: totalQubits, size: parseInt(qreg2[2]) });
      totalQubits += parseInt(qreg2[2]);
      continue;
    }

    // OPENQASM 3: qubit[3] q;
    const qreg3a = line.match(/^qubit\s*\[(\d+)\]\s+(\w+)/);
    if (qreg3a) {
      registers.set(qreg3a[2], { start: totalQubits, size: parseInt(qreg3a[1]) });
      totalQubits += parseInt(qreg3a[1]);
      continue;
    }

    // OPENQASM 3: qubit q;
    const qreg3b = line.match(/^qubit\s+(\w+)/);
    if (qreg3b && !line.includes('[')) {
      registers.set(qreg3b[1], { start: totalQubits, size: 1 });
      totalQubits += 1;
      continue;
    }

    // LEQO-Alias mit geschweiften Klammern:
    //   Einzel-Index:  let <alias> = <reg>[{0}];
    //   Multi-Index:   let <alias> = <reg>[{0, 1}];
    //   → aliasMap: alias    → erster Qubit-Index
    //   → aliasArrayMap: alias → [idx0, idx1, ...]  (für alias[n]-Zugriffe)
    const leqoAlias = line.match(/^let\s+(\w+)\s*=\s*(\w+)\s*\[\s*\{([^}]+)\}\s*\]\s*;?$/);
    if (leqoAlias) {
      const alias   = leqoAlias[1];
      const regName = leqoAlias[2];
      const indices = leqoAlias[3].split(',').map(s => parseInt(s.trim()));
      const reg     = registers.get(regName);
      if (reg !== undefined) {
        // Erster Index als Standard (für Gate ohne Index)
        aliasMap.set(alias, reg.start + indices[0]);
        // Alle Indizes für alias[n]-Zugriffe
        aliasArrayMap.set(alias, indices.map(i => reg.start + i));
      }
      continue;
    }

    // LEQO-Output-Alias:
    //   let <alias>_out = <alias>;
    // Beispiel: let leqo_abc_q0_out = leqo_abc_q0;
    const leqoOutAlias = line.match(/^let\s+(\w+)\s*=\s*(\w+)\s*;?$/);
    if (leqoOutAlias) {
      const newAlias = leqoOutAlias[1];
      const srcAlias = leqoOutAlias[2];
      if (aliasMap.has(srcAlias)) {
        aliasMap.set(newAlias, aliasMap.get(srcAlias)!);
      } else {
        // src könnte ein Register ohne Index sein (size=1)
        const reg = registers.get(srcAlias);
        if (reg) aliasMap.set(newAlias, reg.start);
      }
      continue;
    }
  }

  if (totalQubits === 0) {
    warnings.push('Kein Qubit-Register gefunden. Standardmäßig 1 Qubit angenommen.');
    totalQubits = 1;
  }
  if (totalQubits > 16) {
    warnings.push(`Zu viele Qubits (${totalQubits}). Maximal 16 unterstützt.`);
    totalQubits = Math.min(totalQubits, 16);
  }

  // ---------------------------------------------------------------------------
  // Qubit-Ausdruck auflösen:
  //   1. alias[n]   → aliasArrayMap[alias][n]
  //   2. alias       → aliasMap
  //   3. reg[idx]   → registers
  //   4. reg         → registers (size=1)
  // ---------------------------------------------------------------------------
  function resolveQubit(expr: string): number | null {
    const e = expr.trim().replace(/;$/, '');

    // 1. alias[n] – Index auf einen Multi-Alias (z. B. leqo_abc[1])
    const aliasIdx = e.match(/^(\w+)\[(\d+)\]$/);
    if (aliasIdx) {
      const arr = aliasArrayMap.get(aliasIdx[1]);
      if (arr !== undefined) {
        const n = parseInt(aliasIdx[2]);
        return arr[n] ?? null;
      }
      // Fallback: normales Register mit Standard-Indizes
      const reg = registers.get(aliasIdx[1]);
      if (reg) return reg.start + parseInt(aliasIdx[2]);
    }

    // 2. LEQO-Alias (exakter Name ohne Index)
    if (aliasMap.has(e)) return aliasMap.get(e)!;

    // 3. Standard: reg[idx]  oder  reg[{idx}]
    const withIndex = e.match(/^(\w+)\[\{?(\d+)\}?\]$/);
    if (withIndex) {
      const reg = registers.get(withIndex[1]);
      if (!reg) return null;
      return reg.start + parseInt(withIndex[2]);
    }

    // 4. Ganzes Register (nur sinnvoll wenn size=1)
    const reg = registers.get(e);
    if (reg) return reg.start;

    return null;
  }

  const gates: ParsedGate[] = [];

  // ---------------------------------------------------------------------------
  // Zweiter Pass: Gates parsen
  // ---------------------------------------------------------------------------
  for (const line of lines) {
    // Zeilen überspringen die keine Gate-Aufrufe sind
    if (
      line.startsWith('OPENQASM') ||
      line.startsWith('include') ||
      line.startsWith('qreg') ||
      line.startsWith('creg') ||
      line.startsWith('qubit') ||
      line.startsWith('bit') ||
      line.startsWith('gate ') ||
      line.startsWith('barrier') ||
      line.startsWith('let ') ||        // LEQO-Alias-Definitionen
      line.startsWith('@leqo') ||       // LEQO-Annotationen
      line.startsWith('/*') ||          // Kommentare
      line.startsWith('*') ||
      line.startsWith('/')
    ) {
      continue;
    }

    // Messung: measure q[0] -> c[0];
    // LEQO-Messung: bit[2] x = measure alias[{0,1}];
    if (line.includes('->') || line.startsWith('measure') || line.match(/^bit\b/)) {
      const measureMatch = line.match(/measure\s+(\S+)\s*(?:->|\[)/);
      if (measureMatch) {
        const q = resolveQubit(measureMatch[1]);
        if (q !== null) gates.push({ name: 'measure', qubits: [q], params: [] });
      }
      continue;
    }

    // Gate-Aufruf: gateName(params) qubit1, qubit2;
    //          oder gateName qubit1, qubit2;
    const gateMatch = line.match(/^(\w+)(?:\(([^)]*)\))?\s+(.+?)\s*;?$/);
    if (!gateMatch) continue;

    const rawName   = gateMatch[1].toLowerCase();
    const rawParams = gateMatch[2] ? gateMatch[2].split(',').map(evalParam) : [];
    const rawQubits = gateMatch[3]
      .split(',')
      .map(q => resolveQubit(q.trim()))
      .filter((q): q is number => q !== null);

    if (rawQubits.length === 0) continue;

    gates.push({ name: rawName, qubits: rawQubits, params: rawParams });
  }

  return { numQubits: totalQubits, gates, warnings };
}

// ---------------------------------------------------------------------------
// Simulator
// ---------------------------------------------------------------------------

export function simulate(
  numQubits: number,
  gates: ParsedGate[]
): { sv: Complex[]; warnings: string[] } {
  let sv = createStatevector(numQubits);
  const warnings: string[] = [];

  for (const gate of gates) {
    const [q0, q1] = gate.qubits;
    const [p0, p1, p2] = gate.params;

    switch (gate.name) {
      case 'h':
        sv = applySingleQubitGate(sv, numQubits, q0, GATE_H);
        break;
      case 'x':
        sv = applySingleQubitGate(sv, numQubits, q0, GATE_X);
        break;
      case 'y':
        sv = applySingleQubitGate(sv, numQubits, q0, GATE_Y);
        break;
      case 'z':
        sv = applySingleQubitGate(sv, numQubits, q0, GATE_Z);
        break;
      case 's':
        sv = applySingleQubitGate(sv, numQubits, q0, GATE_S);
        break;
      case 'sdg':
        sv = applySingleQubitGate(sv, numQubits, q0, GATE_SDG);
        break;
      case 't':
        sv = applySingleQubitGate(sv, numQubits, q0, GATE_T);
        break;
      case 'tdg':
        sv = applySingleQubitGate(sv, numQubits, q0, GATE_TDG);
        break;
      case 'rx':
        sv = applySingleQubitGate(sv, numQubits, q0, gateRX(p0 ?? 0));
        break;
      case 'ry':
        sv = applySingleQubitGate(sv, numQubits, q0, gateRY(p0 ?? 0));
        break;
      case 'rz':
      case 'p':
        sv = applySingleQubitGate(sv, numQubits, q0, gateRZ(p0 ?? 0));
        break;
      case 'u1':
        sv = applySingleQubitGate(sv, numQubits, q0, gateRZ(p0 ?? 0));
        break;
      case 'u2':
        sv = applySingleQubitGate(
          sv, numQubits, q0,
          gateU3(Math.PI / 2, p0 ?? 0, p1 ?? 0)
        );
        break;
      case 'u3':
      case 'u':
        sv = applySingleQubitGate(
          sv, numQubits, q0,
          gateU3(p0 ?? 0, p1 ?? 0, p2 ?? 0)
        );
        break;
      case 'cx':
      case 'cnot':
        sv = applyControlledGate(sv, numQubits, q0, q1, GATE_X);
        break;
      case 'cy':
        sv = applyControlledGate(sv, numQubits, q0, q1, GATE_Y);
        break;
      case 'cz':
        sv = applyControlledGate(sv, numQubits, q0, q1, GATE_Z);
        break;
      case 'ch':
        sv = applyControlledGate(sv, numQubits, q0, q1, GATE_H);
        break;
      case 'sx':
        sv = applySingleQubitGate(sv, numQubits, q0, GATE_SX);
        break;
      case 'cp':
      case 'cphase':
        sv = applyControlledGate(sv, numQubits, q0, q1, gateCPMatrix(p0 ?? 0));
        break;
      case 'crx':
        sv = applyControlledGate(sv, numQubits, q0, q1, gateRX(p0 ?? 0));
        break;
      case 'cry':
        sv = applyControlledGate(sv, numQubits, q0, q1, gateRY(p0 ?? 0));
        break;
      case 'crz':
        sv = applyControlledGate(sv, numQubits, q0, q1, gateRZ(p0 ?? 0));
        break;
      case 'cu':
        sv = applyControlledGate(sv, numQubits, q0, q1,
          gateCUMatrix(p0 ?? 0, p1 ?? 0, p2 ?? 0, gate.params[3] ?? 0));
        break;
      case 'ccx':
      case 'toffoli':
        sv = applyToffoli(sv, numQubits, q0, q1, gate.qubits[2]);
        break;
      case 'cswap':
      case 'fredkin':
        sv = applyCSwap(sv, numQubits, q0, q1, gate.qubits[2]);
        break;
      case 'swap':
        sv = applySwap(sv, numQubits, q0, q1);
        break;
      case 'measure':
        // Messung wird in diesem symbolischen Simulator ignoriert
        break;
      default:
        warnings.push(`Unbekanntes Gate: "${gate.name}" — übersprungen.`);
    }
  }

  return { sv, warnings };
}

// ---------------------------------------------------------------------------
// Dirac-Notation rendern
// ---------------------------------------------------------------------------

const THRESHOLD = 1e-8;

/** Rundet kleine Floats auf 0, um Darstellungsrauschen zu eliminieren */
function clean(x: number, eps = 1e-10): number {
  return Math.abs(x) < eps ? 0 : x;
}

/** Formatiert eine Amplitude als lesbaren String */
function formatAmplitude(c: Complex, useLatex: boolean): string {
  const re = clean(c.re);
  const im = clean(c.im);

  const frac = (x: number): string => {
    const abs = Math.abs(x);
    const sign = x < 0 ? '-' : '';
    if (Math.abs(abs - 1) < 1e-8) return sign + '1';
    if (Math.abs(abs - SQRT2_INV) < 1e-8)
      return sign + (useLatex ? '\\frac{1}{\\sqrt{2}}' : '1/√2');
    if (Math.abs(abs - 0.5) < 1e-8)
      return sign + (useLatex ? '\\frac{1}{2}' : '1/2');
    if (Math.abs(abs - 0.25) < 1e-8)
      return sign + (useLatex ? '\\frac{1}{4}' : '1/4');
    if (Math.abs(abs - SQRT2_INV / 2) < 1e-8)
      return sign + (useLatex ? '\\frac{1}{2\\sqrt{2}}' : '1/(2√2)');
    return sign + abs.toFixed(4);
  };

  // Rein reell
  if (im === 0) return frac(re);

  // Rein imaginär: z.B. i/√2 → "i/√2", -i/√2 → "-i/√2"
  if (re === 0) {
    if (Math.abs(im - 1) < 1e-8)  return useLatex ? 'i' : 'i';
    if (Math.abs(im + 1) < 1e-8)  return useLatex ? '-i' : '-i';
    // i · frac(im): schreibe als "i/√2" statt "1/√2i"
    const f = frac(im);
    const absIm = Math.abs(im);
    if (Math.abs(absIm - SQRT2_INV) < 1e-8)
      return (im < 0 ? '-' : '') + (useLatex ? '\\frac{i}{\\sqrt{2}}' : 'i/√2');
    if (Math.abs(absIm - 0.5) < 1e-8)
      return (im < 0 ? '-' : '') + (useLatex ? '\\frac{i}{2}' : 'i/2');
    return f + (useLatex ? 'i' : 'i');
  }

  // Gemischt (re + im·i)
  const imStr = im < 0
    ? ` - ${frac(-im)}i`
    : ` + ${frac(im)}i`;
  return `(${frac(re)}${imStr})`;
}

/**
 * Entfernt die globale Phase aus dem Statevector.
 * Die globale Phase ist physikalisch nicht messbar.
 * Referenz: erster Term mit |amp| > THRESHOLD wird reell+positiv gemacht.
 */
function removeGlobalPhase(sv: Complex[]): Complex[] {
  // Finde ersten nicht-null Eintrag
  let ref: Complex | null = null;
  for (const amp of sv) {
    if (cabs2(amp) > THRESHOLD) { ref = amp; break; }
  }
  if (!ref) return sv;

  const mag = Math.sqrt(cabs2(ref));
  if (mag < 1e-14) return sv;

  // Konjugierte Phase: e^(-iφ) wobei φ = arg(ref)
  const phaseConj: Complex = { re: ref.re / mag, im: -ref.im / mag };

  return sv.map(amp => cmul(amp, phaseConj));
}

export function statevectorToDirac(
  sv: Complex[],
  numQubits: number,
  warnings: string[] = []
): DiracResult {
  // Globale Phase entfernen – physikalisch bedeutungslos, verbessert Lesbarkeit
  const normalizedSv = removeGlobalPhase(sv);
  const terms: DiracTerm[] = [];

  for (let i = 0; i < normalizedSv.length; i++) {
    if (cabs2(normalizedSv[i]) < THRESHOLD) continue;
    const basisState = i.toString(2).padStart(numQubits, '0');
    terms.push({ amplitude: normalizedSv[i], basisState });
  }

  if (terms.length === 0) {
    warnings.push('Statevector ist Null – möglicherweise nach Kollaps durch Messung.');
    return { terms, latex: '0', unicode: '0', numQubits, warnings };
  }

  const renderTerms = (useLatex: boolean): string => {
    return terms
      .map((t, idx) => {
        const amp = formatAmplitude(t.amplitude, useLatex);
        const ket = useLatex
          ? `|${t.basisState}\\rangle`
          : `|${t.basisState}⟩`;
        // Vorzeichen-Behandlung: erstes Glied ohne führendes +
        const prefix =
          idx === 0
            ? amp === '1' ? '' : amp === '-1' ? '-' : amp + ' '
            : amp === '1'
            ? ' + '
            : amp.startsWith('-')
            ? ` - ${amp.slice(1)} `
            : ` + ${amp} `;
        return prefix + ket;
      })
      .join('');
  };

  const latex = renderTerms(true);
  const unicode = renderTerms(false);

  return { terms, latex, unicode, numQubits, warnings };
}

// ---------------------------------------------------------------------------
// Haupt-API
// ---------------------------------------------------------------------------

/**
 * Wandelt einen QASM-String in Dirac-Notation um.
 *
 * @example
 * const result = qasmToDirac(`
 *   OPENQASM 2.0;
 *   include "qelib1.inc";
 *   qreg q[2];
 *   h q[0];
 *   cx q[0], q[1];
 * `);
 * console.log(result.unicode);
 * // 1/√2 |00⟩ + 1/√2 |11⟩
 */
export function qasmToDirac(qasm: string): DiracResult {
  const { numQubits, gates, warnings: parseWarnings } = parseQasm(qasm);
  const { sv, warnings: simWarnings } = simulate(numQubits, gates);
  const result = statevectorToDirac(sv, numQubits, [
    ...parseWarnings,
    ...simWarnings,
  ]);
  return result;
}
