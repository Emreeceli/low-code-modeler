/**
 * backendModal.tsx  (aktualisierte Version)
 *
 * Änderungen gegenüber Original:
 *  - Neuer optionaler Prop `qasmCode` (der openqasmCode-String aus App.tsx)
 *  - Neuer Tab "Dirac-Notation" neben "Compilation Target"
 *  - QasmDiracPanel wird dort eingebettet, sobald qasmCode vorhanden ist
 *
 * In App.tsx den bestehenden <SendRequestModal ... /> Aufruf ersetzen durch:
 *
 *   <SendRequestModal
 *     open={modalOpen}
 *     onClose={() => setModalOpen(false)}
 *     compilationTarget={compilationTarget}
 *     containsPlaceholder={containsPlaceholder}
 *     setCompilationTarget={setCompilationTarget}
 *     sendToBackend={sendToBackend}
 *     qasmCode={openqasmCode}        // <-- NEU
 *   />
 */

import Modal from "./Modal";
import { useEffect, useState } from "react";
import { QasmDiracPanel } from "../QasmDiracPanel";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SendRequestModalProps {
  open: boolean;
  onClose: () => void;
  compilationTarget: string;
  containsPlaceholder: boolean;
  setCompilationTarget: (target: string) => void;
  sendToBackend: () => void;
  /** Der OpenQASM-String aus App.tsx (openqasmCode). Optional – wenn leer,
   *  wird der Dirac-Tab ausgeblendet. */
  qasmCode?: string;
}

// ---------------------------------------------------------------------------
// Komponente
// ---------------------------------------------------------------------------

export const SendRequestModal = ({
  open,
  onClose,
  compilationTarget,
  containsPlaceholder,
  setCompilationTarget,
  sendToBackend,
  qasmCode = "",
}: SendRequestModalProps) => {
  // Automatisch auf "workflow" umschalten wenn placeholder vorhanden
  useEffect(() => {
    if (containsPlaceholder && compilationTarget === "qasm") {
      setCompilationTarget("workflow");
    }
  }, [containsPlaceholder, compilationTarget, setCompilationTarget]);

  // Aktiver Tab: "compile" | "dirac"
  const [activeTab, setActiveTab] = useState<"compile" | "dirac">("compile");

  // Wenn Modal geschlossen wird, Tab zurücksetzen
  useEffect(() => {
    if (!open) setActiveTab("compile");
  }, [open]);

  const hasDirac = qasmCode.trim().length > 0;

  console.log("qasmCode:", qasmCode);

  return (
    <Modal
      title="Send Request To Low-Code Backend"
      open={open}
      onClose={onClose}
      footer={
        <div className="flex justify-end space-x-2">
          {activeTab === "compile" && (
            <button className="btn btn-primary" onClick={sendToBackend}>
              Send
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      }
    >
      <div className="space-y-4">

        {/* ----------------------------------------------------------------
            Tab-Leiste – nur anzeigen wenn QASM-Code vorhanden
        ---------------------------------------------------------------- */}
        {hasDirac && (
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("compile")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "compile"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Compilation
            </button>
            <button
              onClick={() => setActiveTab("dirac")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "dirac"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Dirac-Notation ⟩
            </button>
          </div>
        )}

        {/* ----------------------------------------------------------------
            Tab: Compilation Target (original)
        ---------------------------------------------------------------- */}
        {activeTab === "compile" && (
          <div>
            <label className="block mb-1 font-semibold">
              Compilation Target
            </label>
            <select
              className="select select-bordered w-full"
              value={compilationTarget}
              onChange={(e) => setCompilationTarget(e.target.value)}
            >
              <option value="qasm" disabled={containsPlaceholder}>
                OpenQASM3{" "}
                {containsPlaceholder
                  ? "(not available, placeholder present)"
                  : ""}
              </option>
              <option value="workflow">Workflow</option>
            </select>

            {/* QASM-Vorschau wenn Code vorhanden */}
            {hasDirac && (
              <div className="mt-4">
                <label className="block mb-1 font-semibold text-sm text-gray-600">
                  Letzter QASM-Output
                </label>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono overflow-x-auto max-h-40 whitespace-pre-wrap break-all text-gray-700">
                  {qasmCode}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------------
            Tab: Dirac-Notation
        ---------------------------------------------------------------- */}
        {activeTab === "dirac" && hasDirac && (
          <div className="min-h-[200px]">
            <QasmDiracPanel
              qasm={qasmCode}
              title="Dirac-Darstellung des letzten QASM-Outputs"
            />
          </div>
        )}
      </div>
    </Modal>
  );
};
