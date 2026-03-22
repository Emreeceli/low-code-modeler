/**
 * QasmDiracPanel.tsx
 * Platzierung: src/components/QasmDiracPanel.tsx
 */

import { useMemo, useState } from "react";
import { qasmToDirac } from "./utils/qasmToDirac";
import type { Complex } from "@/lib/diracFormatter";
import { statevectorToDirac } from "@/lib/diracFormatter";

type QasmProps = {
  qasm: string;
  numQubits?: never;
  statevector?: never;
  title?: string;
};

type StatevectorProps = {
  numQubits: number;
  statevector: Complex[];
  qasm?: never;
  title?: string;
};

type Props = QasmProps | StatevectorProps;

function prob(re: number, im: number): number {
  return Math.round((re * re + im * im) * 10000) / 100;
}

// ---------------------------------------------------------------------------
// Histogramm-Komponente
// ---------------------------------------------------------------------------

const BAR_COLOR = "#3b82f6";
const BAR_COLOR_HOVER = "#1d4ed8";
const CHART_HEIGHT = 160;
const BAR_MIN_WIDTH = 24;
const MAX_BARS_BEFORE_SCROLL = 16;

interface HistogramProps {
  terms: { amplitude: { re: number; im: number }; basisState: string }[];
}

function Histogram({ terms }: HistogramProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const data = terms.map((t) => ({
    label: `|${t.basisState}⟩`,
    value: prob(t.amplitude.re, t.amplitude.im),
  }));

  const maxVal = Math.max(...data.map((d) => d.value), 1);

  // Dynamische Balkenbreite
  const needsScroll = data.length > MAX_BARS_BEFORE_SCROLL;
  const barWidth = needsScroll
    ? BAR_MIN_WIDTH
    : Math.max(BAR_MIN_WIDTH, Math.floor(480 / data.length) - 8);
  const gap = needsScroll ? 4 : Math.max(4, Math.floor(barWidth * 0.3));
  const totalWidth = data.length * (barWidth + gap);

  return (
    <div className="w-full overflow-x-auto">
      <div style={{ minWidth: needsScroll ? `${totalWidth}px` : "100%" }}>
        {/* Y-Achse Label */}
        <div className="flex items-end gap-0" style={{ height: `${CHART_HEIGHT + 32}px` }}>

          {/* Y-Achse */}
          <div
            className="flex flex-col justify-between items-end pr-1 flex-shrink-0"
            style={{ height: `${CHART_HEIGHT}px`, marginBottom: "28px" }}
          >
            {[100, 75, 50, 25, 0].map((tick) => (
              <span key={tick} className="text-gray-400" style={{ fontSize: "10px", lineHeight: 1 }}>
                {tick}%
              </span>
            ))}
          </div>

          {/* Balken + X-Labels */}
          <div className="flex flex-col flex-1">
            {/* Grid + Balken */}
            <div
              className="relative flex items-end"
              style={{ height: `${CHART_HEIGHT}px`, borderLeft: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}
            >
              {/* Grid-Linien */}
              {[25, 50, 75].map((tick) => (
                <div
                  key={tick}
                  className="absolute w-full"
                  style={{
                    bottom: `${(tick / 100) * CHART_HEIGHT}px`,
                    borderTop: "1px dashed #f3f4f6",
                    pointerEvents: "none",
                  }}
                />
              ))}

              {/* Balken */}
              <div className="flex items-end w-full h-full px-2" style={{ gap: `${gap}px` }}>
                {data.map((d) => {
                  const barH = Math.max(2, (d.value / 100) * CHART_HEIGHT);
                  const isHov = hovered === d.label;
                  return (
                    <div
                      key={d.label}
                      className="relative flex flex-col items-center group"
                      style={{ width: `${barWidth}px`, flexShrink: 0 }}
                      onMouseEnter={() => setHovered(d.label)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      {/* Tooltip */}
                      {isHov && (
                        <div
                          className="absolute bottom-full mb-1 bg-gray-800 text-white rounded px-2 py-1 whitespace-nowrap z-10"
                          style={{ fontSize: "11px" }}
                        >
                          {d.label}: {d.value}%
                        </div>
                      )}
                      {/* Balken */}
                      <div
                        style={{
                          width: `${barWidth}px`,
                          height: `${barH}px`,
                          backgroundColor: isHov ? BAR_COLOR_HOVER : BAR_COLOR,
                          borderRadius: "3px 3px 0 0",
                          transition: "background-color 0.15s, height 0.3s",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X-Labels */}
            <div className="flex px-2 mt-1" style={{ gap: `${gap}px` }}>
              {data.map((d) => (
                <div
                  key={d.label}
                  className="text-center text-gray-600 font-mono overflow-hidden"
                  style={{
                    width: `${barWidth}px`,
                    flexShrink: 0,
                    fontSize: barWidth < 32 ? "9px" : "11px",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  }}
                  title={d.label}
                >
                  {d.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Haupt-Komponente
// ---------------------------------------------------------------------------

export function QasmDiracPanel(props: Props) {
  const title = props.title ?? "Dirac-Darstellung";
  const [showBasisStates, setShowBasisStates] = useState(true);

  const fullResult = useMemo(() => {
    if ("qasm" in props && props.qasm) return qasmToDirac(props.qasm);
    return null;
  }, [props]);

  const unicodeStr = useMemo(() => {
    if (fullResult) return fullResult.unicode;
    if ("statevector" in props && props.statevector)
      return statevectorToDirac(props.statevector, props.numQubits);
    return null;
  }, [fullResult, props]);

  if (!unicodeStr) {
    return (
      <div className="rounded-xl border p-4 text-sm text-gray-400">
        Kein QASM-Code vorhanden.
      </div>
    );
  }

  const terms = fullResult?.terms ?? [];

  return (
    <div className="rounded-xl border bg-white flex flex-col gap-3 p-4 max-h-[70vh] overflow-y-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <h3 className="text-base font-semibold text-gray-800">{title}</h3>
        <div className="flex items-center gap-3">
          {fullResult && (
            <span className="text-xs text-gray-400">
              {fullResult.numQubits} Qubits · {terms.length} Terme
            </span>
          )}
          {terms.length > 0 && (
            <button
              onClick={() => setShowBasisStates((v) => !v)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-gray-300 hover:bg-gray-100 text-gray-600 transition-colors"
              title="Histogramm ein-/ausblenden"
            >
              <span>{showBasisStates ? "▾" : "▸"}</span>
              Histogramm
            </button>
          )}
        </div>
      </div>

      {/* Warnungen */}
      {fullResult?.warnings && fullResult.warnings.length > 0 && (
        <div className="flex-shrink-0 space-y-1">
          {fullResult.warnings.map((w, i) => (
            <div
              key={i}
              className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5"
            >
              ⚠ {w}
            </div>
          ))}
        </div>
      )}

      {/* Formel */}
      <div className="flex-shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 overflow-x-auto">
        <span className="font-mono text-sm text-gray-800 whitespace-nowrap">
          |ψ⟩ = {unicodeStr}
        </span>
      </div>

      {/* Histogramm */}
      {terms.length > 0 && showBasisStates && (
        <div className="flex-shrink-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Messkwahrscheinlichkeiten
          </p>
          <Histogram terms={terms} />
        </div>
      )}
    </div>
  );
}
