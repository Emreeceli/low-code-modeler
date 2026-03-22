/**
 * DiracOutput.tsx
 *
 * React-Komponente zur Darstellung der Dirac-Notation eines QASM-Schaltkreises.
 *
 * Platzierung im Projekt:
 *   src/components/dirac-output/DiracOutput.tsx
 *
 * Nutzung (z. B. in der Code-View oder einem eigenen Panel):
 *   import DiracOutput from "@/components/dirac-output/DiracOutput";
 *   <DiracOutput qasm={qasmString} />
 */

import React, { useMemo, useState } from "react";
import { qasmToDirac, type DiracResult } from "./utils/qasmToDirac";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DiracOutputProps {
  /** Der rohe QASM-String (OpenQASM 2 oder 3). */
  qasm: string;
  /** Optionaler CSS-Klassenname für das äußere Wrapper-Element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Berechnet die Wahrscheinlichkeit |amplitude|² als Prozentzahl */
function probability(re: number, im: number): number {
  return Math.round((re * re + im * im) * 10000) / 100;
}

// ---------------------------------------------------------------------------
// Unterkomponenten
// ---------------------------------------------------------------------------

/** Einzelner Bra-Ket-Term mit Wahrscheinlichkeitsbalken */
function DiracTerm({
  amplitude,
  basisState,
}: {
  amplitude: { re: number; im: number };
  basisState: string;
}) {
  const prob = probability(amplitude.re, amplitude.im);

  const formatAmp = (re: number, im: number): string => {
    const clean = (x: number) => (Math.abs(x) < 1e-10 ? 0 : x);
    const r = clean(re);
    const i = clean(im);
    const sqrt2inv = 1 / Math.sqrt(2);
    const frac = (x: number): string => {
      const abs = Math.abs(x);
      const sign = x < 0 ? "−" : "";
      if (Math.abs(abs - 1) < 1e-8) return sign + "1";
      if (Math.abs(abs - sqrt2inv) < 1e-8) return sign + "1/√2";
      if (Math.abs(abs - 0.5) < 1e-8) return sign + "1/2";
      if (Math.abs(abs - 0.25) < 1e-8) return sign + "1/4";
      return sign + abs.toFixed(4);
    };
    if (i === 0) return frac(r);
    if (r === 0) {
      if (Math.abs(i - 1) < 1e-8) return "i";
      if (Math.abs(i + 1) < 1e-8) return "−i";
      return frac(i) + "i";
    }
    const imStr = i < 0 ? ` − ${frac(-i)}i` : ` + ${frac(i)}i`;
    return `(${frac(r)}${imStr})`;
  };

  const ampStr = formatAmp(amplitude.re, amplitude.im);

  return (
    <div className="flex items-center gap-3 py-1.5 px-3 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      {/* Amplitude */}
      <span className="font-mono text-sm text-blue-600 dark:text-blue-400 min-w-[72px] text-right">
        {ampStr}
      </span>

      {/* Ket */}
      <span className="font-mono text-base font-semibold text-gray-800 dark:text-gray-100">
        |{basisState}⟩
      </span>

      {/* Probability bar */}
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
            style={{ width: `${prob}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[48px]">
          {prob}%
        </span>
      </div>
    </div>
  );
}

/** Zeigt alle Terme als mathematische Summe (Unicode) */
function DiracFormula({ result }: { result: DiracResult }) {
  return (
    <div className="font-mono text-base leading-loose text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 rounded-lg px-4 py-3 overflow-x-auto whitespace-nowrap border border-gray-200 dark:border-gray-700">
      |ψ⟩ = {result.unicode}
    </div>
  );
}

/** LaTeX-String zum Kopieren */
function LatexBox({ latex }: { latex: string }) {
  const [copied, setCopied] = useState(false);
  const fullLatex = `|\\psi\\rangle = ${latex}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullLatex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative group">
      <pre className="font-mono text-xs bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 overflow-x-auto text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all">
        {fullLatex}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? "✓ Kopiert" : "Kopieren"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Haupt-Komponente
// ---------------------------------------------------------------------------

const DiracOutput: React.FC<DiracOutputProps> = ({ qasm, className = "" }) => {
  const [showLatex, setShowLatex] = useState(false);

  const result: DiracResult = useMemo(() => {
    if (!qasm || qasm.trim().length === 0) {
      return {
        terms: [],
        latex: "0",
        unicode: "0",
        numQubits: 0,
        warnings: ["Kein QASM-Code vorhanden."],
      };
    }
    return qasmToDirac(qasm);
  }, [qasm]);

  return (
    <div
      className={`flex flex-col gap-4 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">⟩</span>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Dirac-Notation
          </h3>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            ({result.numQubits} Qubit{result.numQubits !== 1 ? "s" : ""},{" "}
            {result.terms.length} Term{result.terms.length !== 1 ? "e" : ""})
          </span>
        </div>

        {/* LaTeX toggle */}
        <button
          onClick={() => setShowLatex((v) => !v)}
          className="text-xs px-3 py-1 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
        >
          {showLatex ? "Formel anzeigen" : "LaTeX anzeigen"}
        </button>
      </div>

      {/* Warnungen */}
      {result.warnings.length > 0 && (
        <div className="flex flex-col gap-1">
          {result.warnings.map((w, i) => (
            <div
              key={i}
              className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded px-3 py-1.5"
            >
              ⚠ {w}
            </div>
          ))}
        </div>
      )}

      {/* Formel oder LaTeX */}
      {result.terms.length > 0 && (
        <>
          {showLatex ? (
            <LatexBox latex={result.latex} />
          ) : (
            <DiracFormula result={result} />
          )}

          {/* Terme mit Wahrscheinlichkeiten */}
          <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {result.terms.map((term) => (
              <DiracTerm
                key={term.basisState}
                amplitude={term.amplitude}
                basisState={term.basisState}
              />
            ))}
          </div>
        </>
      )}

      {result.terms.length === 0 && result.warnings.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
          Kein gültiger Quantenzustand.
        </p>
      )}
    </div>
  );
};

export default DiracOutput;
