/**
 * QasmDiracPanel.tsx
 * Platzierung: src/components/QasmDiracPanel.tsx
 */

import { useMemo, useState, useEffect } from "react";
import { qasmToDirac } from "./utils/qasmToDirac";
import type { Complex } from "@/lib/diracFormatter";
import { statevectorToDirac } from "@/lib/diracFormatter";

type QasmProps = {
  qasm: string;
  numQubits?: never;
  statevector?: never;
  title?: string;
  onGetCircuitSvg?: () => Promise<string>;
};

type StatevectorProps = {
  numQubits: number;
  statevector: Complex[];
  qasm?: never;
  title?: string;
  onGetCircuitSvg?: () => Promise<string>;
};

type Props = QasmProps | StatevectorProps;

function prob(re: number, im: number): number {
  return Math.round((re * re + im * im) * 10000) / 100;
}

const BAR_COLOR = "#3b82f6";
const BAR_COLOR_HOVER = "#1d4ed8";
const CHART_HEIGHT = 160;
const BAR_MIN_WIDTH = 24;
const MAX_BARS_BEFORE_SCROLL = 16;

// ---------------------------------------------------------------------------
// LaTeX Export
// ---------------------------------------------------------------------------

/**
 * Konvertiert einen SVG-String (oder SVG Data-URL) im Browser zu einem PNG-Base64-String.
 */
async function svgToPngBase64(svgInput: string, scale = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    // Akzeptiert sowohl rohen SVG-Text als auch Data-URLs
    let objectUrl: string;
    if (svgInput.startsWith("data:")) {
      // Data-URL direkt verwenden
      objectUrl = svgInput;
    } else {
      // Roher SVG-Text → Blob URL
      const blob = new Blob([svgInput], { type: "image/svg+xml" });
      objectUrl = URL.createObjectURL(blob);
    }

    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = (img.naturalWidth || 1200) * scale;
      canvas.height = (img.naturalHeight || 800) * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      if (!svgInput.startsWith("data:")) URL.revokeObjectURL(objectUrl);
      const base64 = canvas.toDataURL("image/png").split(",")[1];
      resolve(base64);
    };

    img.onerror = (e) => {
      if (!svgInput.startsWith("data:")) URL.revokeObjectURL(objectUrl);
      reject(e);
    };

    img.src = objectUrl;
  });
}

function buildLatexExport(
  latex: string,
  numQubits: number,
  terms: any[],
  pngBase64?: string
): string {
  const termLines = terms
    .map((t) => {
      const p = prob(t.amplitude.re, t.amplitude.im);
      return `    \\hline\n    $|${t.basisState}\\rangle$ & $${p}\\%$ \\\\`;
    })
    .join("\n");

  const circuitSection = pngBase64
    ? `\\section*{Quantenschaltkreis}

\\begin{figure}[h]
  \\centering
  \\includegraphics[width=0.9\\textwidth]{circuit}
  \\caption{Modellierter Quantenschaltkreis}
  \\label{fig:circuit}
\\end{figure}

`
    : "";

  const tableSection = terms.length > 0
    ? `\\section*{Messwahrscheinlichkeiten}

\\begin{table}[h]
  \\centering
  \\begin{tabular}{|c|c|}
    \\hline
    \\textbf{Basiszustand} & \\textbf{Wahrscheinlichkeit} \\\\
${termLines}
    \\hline
  \\end{tabular}
  \\caption{Messwahrscheinlichkeiten der Basiszustände}
\\end{table}

`
    : "";

  const hint = pngBase64
    ? "% OVERLEAF: circuit.png separat hochladen (Export → \"Circuit PNG\")\n"
    : "";

  return `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{braket}
\\usepackage{graphicx}
\\usepackage{geometry}
\\geometry{margin=2.5cm}

${hint}
\\title{Dirac-Notation -- Quantum Low-Code Modeler}
\\date{\\today}

\\begin{document}

\\maketitle

${circuitSection}\\section*{Quantenzustand in Dirac-Notation}

Der Zustand des Quantensystems mit ${numQubits} Qubit${numQubits !== 1 ? "s" : ""} ist:

\\begin{equation}
  |\\psi\\rangle = ${latex}
\\end{equation}

${tableSection}\\end{document}
`;
}

function downloadTex(content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dirac_notation.tex";
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Export-Menü
// ---------------------------------------------------------------------------

function ExportMenu({ latex, numQubits, terms, unicode, onGetCircuitSvg }: {
  latex: string;
  numQubits: number;
  terms: any[];
  unicode: string;
  onGetCircuitSvg?: () => Promise<string>;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [loadingSvg, setLoadingSvg] = useState(false);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
    setOpen(false);
  };

  const handleDownloadTex = async (withCircuit: boolean) => {
    setOpen(false);
    if (withCircuit && onGetCircuitSvg) {
      setLoadingSvg(true);
      try {
        const svg = await onGetCircuitSvg();
        const pngBase64 = await svgToPngBase64(svg);
        downloadTex(buildLatexExport(latex, numQubits, terms, pngBase64));
      } catch (e) {
        console.error("Export fehlgeschlagen:", e);
        downloadTex(buildLatexExport(latex, numQubits, terms));
      } finally {
        setLoadingSvg(false);
      }
    } else {
      downloadTex(buildLatexExport(latex, numQubits, terms));
    }
  };

  const handleDownloadPng = async () => {
    setOpen(false);
    if (!onGetCircuitSvg) return;
    setLoadingSvg(true);
    try {
      const svg = await onGetCircuitSvg();
      const pngBase64 = await svgToPngBase64(svg);
      const a = document.createElement("a");
      a.href = `data:image/png;base64,${pngBase64}`;
      a.download = "circuit.png";
      a.click();
    } catch (e) {
      console.error("PNG Export fehlgeschlagen:", e);
    } finally {
      setLoadingSvg(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loadingSvg}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-gray-300 hover:bg-gray-100 text-gray-600 transition-colors disabled:opacity-50"
      >
        {loadingSvg ? "⏳ Exportiere..." : "↑ Export"}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-64 py-1 text-sm">

            {/* Kopieren */}
            <button onClick={() => copy(`|\\psi\\rangle = ${latex}`, "latex")}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-2">
              <span>𝜓</span>{copied === "latex" ? "✓ Kopiert!" : "LaTeX kopieren"}
            </button>
            <button onClick={() => copy(unicode, "unicode")}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-2">
              <span>⟩</span>{copied === "unicode" ? "✓ Kopiert!" : "Unicode kopieren"}
            </button>

            <hr className="my-1 border-gray-100" />
            <p className="px-3 py-1 text-gray-400" style={{ fontSize: "10px" }}>OVERLEAF EXPORT</p>

            {/* .tex ohne Schaltkreis */}
            <button onClick={() => handleDownloadTex(false)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-2">
              <span>↓</span>
              <span>
                <span className="block">main.tex herunterladen</span>
                <span className="block text-gray-400" style={{ fontSize: "10px" }}>fertiges LaTeX-Dokument</span>
              </span>
            </button>

            {/* .tex + Schaltkreisreferenz */}
            {onGetCircuitSvg && (
              <>
                <button onClick={() => handleDownloadTex(true)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-2">
                  <span>↓</span>
                  <span>
                    <span className="block">main.tex mit Schaltkreis</span>
                    <span className="block text-gray-400" style={{ fontSize: "10px" }}>+ circuit.png separat hochladen</span>
                  </span>
                </button>
                <button onClick={handleDownloadPng}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700 flex items-center gap-2">
                  <span>↓</span>
                  <span>
                    <span className="block">circuit.png herunterladen</span>
                    <span className="block text-gray-400" style={{ fontSize: "10px" }}>Schaltkreis-Bild für Overleaf</span>
                  </span>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Qubit-Selektor
// ---------------------------------------------------------------------------

interface QubitSelectorProps {
  numQubits: number;
  selected: number[];
  onChange: (selected: number[]) => void;
}

function QubitSelector({ numQubits, selected, onChange }: QubitSelectorProps) {
  const allSelected = selected.length === numQubits;
  const toggle = (q: number) => {
    if (selected.includes(q)) {
      if (selected.length === 1) return;
      onChange(selected.filter((x) => x !== q));
    } else {
      onChange([...selected, q].sort((a, b) => a - b));
    }
  };
  const toggleAll = () => {
    if (allSelected) onChange([0]);
    else onChange(Array.from({ length: numQubits }, (_, i) => i));
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-gray-500 mr-1">Qubits:</span>
      <button
        onClick={toggleAll}
        className={`text-xs px-2 py-0.5 rounded border transition-colors ${
          allSelected ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
        }`}
      >
        Alle
      </button>
      {Array.from({ length: numQubits }, (_, i) => (
        <button key={i} onClick={() => toggle(i)}
          className={`text-xs px-2 py-0.5 rounded border font-mono transition-colors ${
            selected.includes(i) ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          }`}
        >
          q{i}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Histogramm
// ---------------------------------------------------------------------------

interface HistogramBar { label: string; value: number; }

function Histogram({ data }: { data: HistogramBar[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const needsScroll = data.length > MAX_BARS_BEFORE_SCROLL;
  const barWidth = needsScroll ? BAR_MIN_WIDTH : Math.max(BAR_MIN_WIDTH, Math.floor(480 / data.length) - 8);
  const gap = needsScroll ? 4 : Math.max(4, Math.floor(barWidth * 0.3));
  const totalWidth = data.length * (barWidth + gap);

  return (
    <div className="w-full overflow-x-auto">
      <div style={{ minWidth: needsScroll ? `${totalWidth}px` : "100%" }}>
        <div className="flex items-end" style={{ height: `${CHART_HEIGHT + 32}px` }}>
          <div className="flex flex-col justify-between items-end pr-1 flex-shrink-0"
            style={{ height: `${CHART_HEIGHT}px`, marginBottom: "28px" }}>
            {[100, 75, 50, 25, 0].map((tick) => (
              <span key={tick} className="text-gray-400" style={{ fontSize: "10px", lineHeight: 1 }}>{tick}%</span>
            ))}
          </div>
          <div className="flex flex-col flex-1">
            <div className="relative flex items-end"
              style={{ height: `${CHART_HEIGHT}px`, borderLeft: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>
              {[25, 50, 75].map((tick) => (
                <div key={tick} className="absolute w-full"
                  style={{ bottom: `${(tick / 100) * CHART_HEIGHT}px`, borderTop: "1px dashed #f3f4f6", pointerEvents: "none" }} />
              ))}
              <div className="flex items-end w-full h-full px-2" style={{ gap: `${gap}px` }}>
                {data.map((d) => {
                  const barH = Math.max(2, (d.value / 100) * CHART_HEIGHT);
                  const isHov = hovered === d.label;
                  return (
                    <div key={d.label} className="relative flex flex-col items-center"
                      style={{ width: `${barWidth}px`, flexShrink: 0 }}
                      onMouseEnter={() => setHovered(d.label)}
                      onMouseLeave={() => setHovered(null)}>
                      {isHov && (
                        <div className="absolute bottom-full mb-1 bg-gray-800 text-white rounded px-2 py-1 whitespace-nowrap z-10"
                          style={{ fontSize: "11px" }}>
                          {d.label}: {d.value}%
                        </div>
                      )}
                      <div style={{
                        width: `${barWidth}px`, height: `${barH}px`,
                        backgroundColor: isHov ? BAR_COLOR_HOVER : BAR_COLOR,
                        borderRadius: "3px 3px 0 0", transition: "background-color 0.15s",
                      }} />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex px-2 mt-1" style={{ gap: `${gap}px` }}>
              {data.map((d) => (
                <div key={d.label} className="text-center text-gray-600 font-mono overflow-hidden"
                  style={{ width: `${barWidth}px`, flexShrink: 0, fontSize: barWidth < 32 ? "9px" : "11px", whiteSpace: "nowrap", textOverflow: "ellipsis" }}
                  title={d.label}>{d.label}</div>
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

  const numQubits = fullResult?.numQubits ?? ("numQubits" in props ? props.numQubits : 0);

  const [selectedQubits, setSelectedQubits] = useState<number[]>([]);

  // Wenn numQubits sich ändert (neues QASM geladen), alle Qubits auswählen
  useEffect(() => {
    if (numQubits > 0) {
      setSelectedQubits(Array.from({ length: numQubits }, (_, i) => i));
    }
  }, [numQubits]);

  const effectiveSelected = useMemo(() => {
    if (selectedQubits.length === 0 || selectedQubits.some((q) => q >= numQubits))
      return Array.from({ length: numQubits }, (_, i) => i);
    return selectedQubits;
  }, [selectedQubits, numQubits]);

  const histogramData = useMemo((): HistogramBar[] => {
    if (!fullResult) return [];
    const allSelected = effectiveSelected.length === numQubits;
    if (allSelected) {
      return fullResult.terms.map((t) => ({
        label: `|${t.basisState}⟩`,
        value: prob(t.amplitude.re, t.amplitude.im),
      }));
    }
    const reducedSize = 1 << effectiveSelected.length;
    const probs = new Array(reducedSize).fill(0);
    for (const term of fullResult.terms) {
      const p = prob(term.amplitude.re, term.amplitude.im) / 100;
      let reducedIdx = 0;
      for (let k = 0; k < effectiveSelected.length; k++) {
        const bitVal = parseInt(term.basisState[effectiveSelected[k]] ?? "0");
        reducedIdx |= bitVal << (effectiveSelected.length - 1 - k);
      }
      probs[reducedIdx] += p;
    }
    return probs
      .map((p, idx) => ({
        label: `|${idx.toString(2).padStart(effectiveSelected.length, "0")}⟩`,
        value: Math.round(p * 10000) / 100,
      }))
      .filter((d) => d.value > 0.001);
  }, [fullResult, effectiveSelected, numQubits]);

  if (!unicodeStr) {
    return (
      <div className="rounded-xl border p-4 text-sm text-gray-400">
        Kein QASM-Code vorhanden.
      </div>
    );
  }

  const terms = fullResult?.terms ?? [];
  const isPartial = effectiveSelected.length < numQubits;

  return (
    <div className="rounded-xl border bg-white flex flex-col gap-3 p-4 max-h-[70vh] overflow-y-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <h3 className="text-base font-semibold text-gray-800">{title}</h3>
        <div className="flex items-center gap-2">
          {fullResult && (
            <span className="text-xs text-gray-400">
              {numQubits} Qubits · {terms.length} Terme
            </span>
          )}
          {terms.length > 0 && (
            <button
              onClick={() => setShowBasisStates((v) => !v)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-gray-300 hover:bg-gray-100 text-gray-600 transition-colors"
            >
              <span>{showBasisStates ? "▾" : "▸"}</span>
              Histogramm
            </button>
          )}
          {fullResult && terms.length > 0 && (
            <ExportMenu
              latex={fullResult.latex}
              numQubits={numQubits}
              terms={terms}
              unicode={fullResult.unicode}
              onGetCircuitSvg={props.onGetCircuitSvg}
            />
          )}
        </div>
      </div>

      {/* Warnungen */}
      {fullResult?.warnings && fullResult.warnings.length > 0 && (
        <div className="flex-shrink-0 space-y-1">
          {fullResult.warnings.map((w, i) => (
            <div key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
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

      {/* Histogramm + Qubit-Selektor */}
      {terms.length > 0 && showBasisStates && (
        <div className="flex-shrink-0 flex flex-col gap-2">
          {numQubits > 1 && (
            <div className="flex flex-col gap-1">
              <QubitSelector numQubits={numQubits} selected={effectiveSelected} onChange={setSelectedQubits} />
              {isPartial && (
                <p className="text-xs text-blue-600">
                  Partielle Messung: Wahrscheinlichkeiten über nicht gewählte Qubits aufsummiert
                </p>
              )}
            </div>
          )}
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Messwahrscheinlichkeiten{isPartial && ` (q${effectiveSelected.join(", q")})`}
          </p>
          <Histogram data={histogramData} />
        </div>
      )}
    </div>
  );
}
