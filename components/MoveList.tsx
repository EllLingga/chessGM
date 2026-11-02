"use client";
import { META, Category } from "@/lib/classify";

export default function MoveList({ sans, cats, view, onSelect }: {
  sans: string[]; cats?: (string | undefined)[]; view: number; onSelect: (n: number) => void;
}) {
  const rows: number[] = [];
  for (let i = 0; i < sans.length; i += 2) rows.push(i);
  const cell = (i: number) => {
    if (i >= sans.length) return <td />;
    const meta = cats?.[i] ? META[cats[i] as Category] : null;
    return (
      <td>
        <button onClick={() => onSelect(i + 1)}
          className={`w-full text-left px-2 py-1 rounded text-sm flex items-center gap-1.5 hover:bg-neutral-800 ${view === i + 1 ? "bg-neutral-700" : ""}`}>
          <span>{sans[i]}</span>
          {meta && <span className="text-xs font-bold" style={{ color: meta.color }} title={meta.label}>{meta.icon}</span>}
        </button>
      </td>
    );
  };
  if (!sans.length) return <p className="p-2 text-sm text-neutral-500">Belum ada langkah.</p>;
  return (
    <table className="w-full"><tbody>
      {rows.map((i) => (
        <tr key={i}><td className="w-8 px-2 text-xs text-neutral-500">{i / 2 + 1}.</td>{cell(i)}{cell(i + 1)}</tr>
      ))}
    </tbody></table>
  );
}
