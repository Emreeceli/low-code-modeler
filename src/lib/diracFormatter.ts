/**
 * diracFormatter.ts
 *
 * Platzierung: src/components/lib/diracFormatter.ts
 *
 * Bridge zwischen QasmDiracPanel und der Kernlogik in utils/qasmToDirac.ts.
 * Exportiert genau das, was QasmDiracPanel.tsx erwartet:
 *   - Typ  Complex
 *   - Funktion statevectorToDirac(sv, numQubits) → string (Unicode)
 */

export type { Complex } from "../components/utils/qasmToDirac";
import { statevectorToDirac as _statevectorToDirac } from "../components/utils/qasmToDirac";
import type { Complex } from "../components/utils/qasmToDirac";

/**
 * Wandelt einen Statevector in einen lesbaren Dirac-Notation-String um.
 *
 * @param statevector  Array von Complex-Amplituden, Länge muss 2^numQubits sein.
 * @param numQubits    Anzahl der Qubits.
 * @returns            Unicode-String, z. B. "1/√2 |00⟩ + 1/√2 |11⟩"
 *
 * @example
 * // Bell-Zustand Φ+
 * const sv: Complex[] = [
 *   { re: 1/Math.sqrt(2), im: 0 },  // |00⟩
 *   { re: 0, im: 0 },               // |01⟩
 *   { re: 0, im: 0 },               // |10⟩
 *   { re: 1/Math.sqrt(2), im: 0 },  // |11⟩
 * ];
 * statevectorToDirac(sv, 2);
 * // → "1/√2 |00⟩ + 1/√2 |11⟩"
 */
export function statevectorToDirac(
  statevector: Complex[],
  numQubits: number
): string {
  const result = _statevectorToDirac(statevector, numQubits);
  return result.unicode;
}
