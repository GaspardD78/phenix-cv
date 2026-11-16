import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { getAllTemplates, getTemplate } from '../../templates';
import { CATEGORY_LABELS, CATEGORY_HINTS, type TemplateCategory } from '../../theme/tokens';

interface TemplatePickerPopoverProps {
  currentTemplateId: string;
  onSelect: (templateId: string) => void;
}

// ── Mini SVG previews ──────────────────────────────────────────────────────
// Chaque preview utilise la couleur d'accent de la palette principale du template.

interface PreviewProps {
  accent: string;
  ink?: string;
}

function PreviewClassic({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="16" y="10" width="48" height="4" rx="0.5" fill={ink} />
      <rect x="22" y="17" width="36" height="2" rx="0.5" fill="#6b7280" />
      <rect x="8" y="22" width="64" height="0.8" fill={accent} />
      {[30, 52, 74, 92].map((y, i) => (
        <g key={i}>
          <rect x="8" y={y} width="30" height="2" rx="0.3" fill={ink} />
          <rect x="8" y={y + 3} width="64" height="0.5" fill="#d1d5db" />
          <rect x="8" y={y + 6} width="60" height="1.3" fill="#e5e7eb" />
          <rect x="8" y={y + 10} width="56" height="1.3" fill="#e5e7eb" />
          {y !== 92 && <rect x="8" y={y + 14} width="50" height="1.3" fill="#e5e7eb" />}
        </g>
      ))}
    </svg>
  );
}

function PreviewModern({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="22" y="10" width="36" height="4" rx="0.5" fill={ink} />
      <rect x="26" y="17" width="28" height="2" rx="0.5" fill={accent} />
      {[28, 52, 76, 94].map((y, i) => (
        <g key={i}>
          <rect x="8" y={y} width="26" height="2" rx="0.3" fill={accent} />
          <rect x="8" y={y + 3.5} width="64" height="0.8" fill={accent} opacity="0.4" />
          <rect x="8" y={y + 7} width="58" height="1.3" fill="#e5e7eb" />
          <rect x="8" y={y + 10.5} width="62" height="1.3" fill="#e5e7eb" />
          {y !== 94 && <rect x="8" y={y + 14} width="54" height="1.3" fill="#e5e7eb" />}
        </g>
      ))}
    </svg>
  );
}

function PreviewElegant({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="0" y="0" width="2.5" height="110" fill={accent} />
      <rect x="18" y="10" width="44" height="4" rx="0.5" fill={ink} />
      <rect x="24" y="17" width="32" height="2" rx="0.5" fill={accent} opacity="0.8" />
      {[28, 50, 72, 92].map((y, i) => (
        <g key={i}>
          <rect x="10" y={y} width="24" height="1.8" rx="0.3" fill={accent} />
          <rect x="10" y={y + 3} width="60" height="0.4" fill={accent} opacity="0.3" />
          <rect x="10" y={y + 6} width="60" height="1.2" fill="#e5e7eb" />
          <rect x="10" y={y + 9.5} width="54" height="1.2" fill="#e5e7eb" />
          {y !== 92 && <rect x="10" y={y + 13} width="50" height="1.2" fill="#e5e7eb" />}
        </g>
      ))}
    </svg>
  );
}

function PreviewMinimalist({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="10" y="14" width="30" height="3" rx="0.3" fill={ink} />
      <rect x="10" y="20" width="18" height="1.3" rx="0.3" fill="#9ca3af" />
      {[34, 56, 78, 96].map((y, i) => (
        <g key={i}>
          <rect x="10" y={y} width="14" height="1.3" rx="0.2" fill={accent} opacity="0.6" />
          <rect x="10" y={y + 4} width="60" height="1" fill="#f3f4f6" />
          <rect x="10" y={y + 7.5} width="56" height="1" fill="#f3f4f6" />
          {y !== 96 && <rect x="10" y={y + 11} width="52" height="1" fill="#f3f4f6" />}
        </g>
      ))}
    </svg>
  );
}

function PreviewTech({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="8" y="10" width="38" height="3.5" rx="0.3" fill={ink} />
      <rect x="8" y="16" width="24" height="1.5" rx="0.2" fill={accent} />
      <rect x="8" y="22" width="64" height="0.6" fill={accent} opacity="0.5" />
      {/* Skills badges */}
      <g>
        <rect x="8" y="28" width="20" height="1.8" rx="0.3" fill={accent} />
        <rect x="8" y="32" width="10" height="3" rx="0.8" fill={accent} opacity="0.2" />
        <rect x="20" y="32" width="12" height="3" rx="0.8" fill={accent} opacity="0.2" />
        <rect x="34" y="32" width="9" height="3" rx="0.8" fill={accent} opacity="0.2" />
        <rect x="45" y="32" width="11" height="3" rx="0.8" fill={accent} opacity="0.2" />
        <rect x="58" y="32" width="8" height="3" rx="0.8" fill={accent} opacity="0.2" />
      </g>
      {[42, 62, 80, 96].map((y, i) => (
        <g key={i}>
          <rect x="8" y={y} width="22" height="1.8" rx="0.3" fill={accent} />
          <rect x="8" y={y + 4} width="60" height="1" fill="#e5e7eb" />
          <rect x="8" y={y + 7} width="56" height="1" fill="#e5e7eb" />
          {y !== 96 && <rect x="8" y={y + 10} width="52" height="1" fill="#e5e7eb" />}
        </g>
      ))}
    </svg>
  );
}

function PreviewExecutive({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="14" y="10" width="52" height="4.5" rx="0.3" fill={ink} />
      <rect x="22" y="17" width="36" height="2" rx="0.3" fill={accent} />
      <rect x="12" y="22" width="56" height="0.5" fill={accent} opacity="0.5" />
      {[28, 50, 72, 92].map((y, i) => (
        <g key={i}>
          <rect x="20" y={y} width="40" height="0.5" fill={accent} />
          <rect x="26" y={y + 2} width="28" height="2" rx="0.3" fill={accent} />
          <rect x="20" y={y + 5.5} width="40" height="0.5" fill={accent} />
          <rect x="8" y={y + 8.5} width="64" height="1.1" fill="#e5e7eb" />
          <rect x="8" y={y + 11.5} width="60" height="1.1" fill="#e5e7eb" />
          {y !== 92 && <rect x="8" y={y + 14.5} width="56" height="1.1" fill="#e5e7eb" />}
        </g>
      ))}
    </svg>
  );
}

function PreviewCreative({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="6" y="8" width="52" height="6" rx="0.5" fill={ink} />
      <rect x="6" y="16" width="32" height="2" rx="0.3" fill={accent} />
      {[26, 50, 74, 94].map((y, i) => (
        <g key={i}>
          <rect x="8" y={y} width="22" height="2.2" rx="0.3" fill={accent} />
          <rect x="8" y={y + 3.2} width="8" height="1" fill={accent} />
          <rect x="8" y={y + 6} width="60" height="1.2" fill="#e5e7eb" />
          <rect x="8" y={y + 9} width="58" height="1.2" fill="#e5e7eb" />
          {y !== 94 && <rect x="8" y={y + 12} width="50" height="1.2" fill="#e5e7eb" />}
        </g>
      ))}
      {/* Skills badges rounded */}
      <g>
        <rect x="8" y="36" width="12" height="3.5" rx="1.5" fill={accent} opacity="0.25" />
        <rect x="22" y="36" width="14" height="3.5" rx="1.5" fill={accent} opacity="0.25" />
        <rect x="38" y="36" width="10" height="3.5" rx="1.5" fill={accent} opacity="0.25" />
      </g>
    </svg>
  );
}

function PreviewAcademic({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="16" y="9" width="48" height="3.5" rx="0.3" fill={ink} />
      <rect x="24" y="15" width="32" height="1.5" rx="0.3" fill={accent} />
      <rect x="8" y="19" width="64" height="0.5" fill={accent} opacity="0.5" />
      {[23, 42, 60, 78, 94].map((y, i) => (
        <g key={i}>
          <rect x="8" y={y} width="24" height="1.6" rx="0.3" fill={accent} />
          <rect x="8" y={y + 3} width="62" height="0.8" fill="#f3f4f6" />
          <rect x="8" y={y + 5} width="58" height="0.8" fill="#f3f4f6" />
          <rect x="8" y={y + 7} width="60" height="0.8" fill="#f3f4f6" />
          {y !== 94 && <rect x="8" y={y + 9} width="54" height="0.8" fill="#f3f4f6" />}
        </g>
      ))}
    </svg>
  );
}

/** Two-column sidebar preview (graphic templates). */
function PreviewSidebar({
  accent, ink = '#111827', side = 'left', band,
}: PreviewProps & { side?: 'left' | 'right'; band?: string }) {
  const bandW = 28;
  const bandX = side === 'left' ? 0 : 80 - bandW;
  const mainX = side === 'left' ? bandW + 5 : 5;
  const cx = bandX + bandW / 2;
  const bandColor = band || ink;
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      {/* Sidebar band */}
      <rect x={bandX} y="0" width={bandW} height="110" fill={bandColor} />
      {/* Photo */}
      <circle cx={cx} cy="16" r="9" fill="white" opacity="0.9" />
      {/* Contact lines */}
      {[30, 33, 36].map((y) => (
        <rect key={y} x={bandX + 5} y={y} width="18" height="1.2" rx="0.4" fill="white" opacity="0.55" />
      ))}
      {/* Sidebar section heading + pills */}
      <rect x={bandX + 5} y="44" width="14" height="1.6" rx="0.4" fill="white" opacity="0.85" />
      {[[5, 49, 9], [16, 49, 7], [5, 53, 7], [14, 53, 9]].map(([x, y, w], i) => (
        <rect key={i} x={bandX + x} y={y} width={w} height="3" rx="1.5" fill="white" opacity="0.28" />
      ))}
      <rect x={bandX + 5} y="62" width="14" height="1.6" rx="0.4" fill="white" opacity="0.85" />
      {[67, 70, 73].map((y) => (
        <rect key={y} x={bandX + 5} y={y} width="17" height="1.2" rx="0.4" fill="white" opacity="0.5" />
      ))}
      {/* Main column: name + title */}
      <rect x={mainX} y="10" width="34" height="4" rx="0.5" fill={ink} />
      <rect x={mainX} y="16" width="22" height="2" rx="0.4" fill={accent} />
      {/* Main sections */}
      {[26, 50, 76, 96].map((y, i) => (
        <g key={i}>
          <rect x={mainX} y={y} width="24" height="2" rx="0.3" fill={accent} />
          <rect x={mainX} y={y + 3.5} width="42" height="0.6" fill={accent} opacity="0.4" />
          <rect x={mainX} y={y + 6} width="42" height="1.2" fill="#e5e7eb" />
          <rect x={mainX} y={y + 9} width="38" height="1.2" fill="#e5e7eb" />
          {y !== 96 && <rect x={mainX} y={y + 12} width="40" height="1.2" fill="#e5e7eb" />}
        </g>
      ))}
    </svg>
  );
}

function PreviewSidebarModern(p: PreviewProps) {
  return <PreviewSidebar {...p} side="left" band="#1e293b" />;
}
function PreviewSidebarTech(p: PreviewProps) {
  return <PreviewSidebar {...p} side="left" band="#064e3b" />;
}
function PreviewSidebarElegant(p: PreviewProps) {
  return <PreviewSidebar {...p} side="right" band="#cbd5e1" ink={p.ink} />;
}

/** Chronologique : en-tête à gauche, dates dans une marge à gauche de chaque entrée. */
function PreviewChrono({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="8" y="9" width="40" height="4" rx="0.5" fill={ink} />
      <rect x="8" y="15.5" width="26" height="2" rx="0.4" fill={accent} />
      <rect x="8" y="20" width="56" height="1.1" fill="#9ca3af" />
      {[28, 54, 80].map((y, i) => (
        <g key={i}>
          <rect x="8" y={y} width="26" height="1.8" rx="0.3" fill={accent} />
          <rect x="8" y={y + 3} width="64" height="0.5" fill={accent} opacity="0.35" />
          {[0, 1].map((k) => (
            <g key={k}>
              <rect x="8" y={y + 6 + k * 10} width="12" height="1.4" rx="0.3" fill={accent} opacity="0.85" />
              <rect x="24" y={y + 6 + k * 10} width="30" height="1.6" rx="0.3" fill={ink} />
              <rect x="24" y={y + 9 + k * 10} width="46" height="1.1" fill="#e5e7eb" />
              <rect x="24" y={y + 11.5 + k * 10} width="40" height="1.1" fill="#e5e7eb" />
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

/** En-tête scindé : nom à gauche, coordonnées à droite, filet épais, repères verticaux. */
function PreviewScinde({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="8" y="9" width="32" height="4.5" rx="0.5" fill={ink} />
      <rect x="8" y="16" width="22" height="2" rx="0.4" fill={accent} />
      {[9, 12, 15, 18].map((y) => (
        <rect key={y} x="52" y={y} width="20" height="1.2" rx="0.3" fill="#9ca3af" />
      ))}
      <rect x="8" y="22" width="64" height="1.6" fill={accent} />
      {[30, 54, 78, 96].map((y, i) => (
        <g key={i}>
          <rect x="8" y={y} width="1.6" height="3" fill={accent} />
          <rect x="11.5" y={y + 0.6} width="24" height="1.8" rx="0.3" fill={ink} />
          <rect x="8" y={y + 6} width="60" height="1.2" fill="#e5e7eb" />
          <rect x="8" y={y + 9.5} width="56" height="1.2" fill="#e5e7eb" />
          {y !== 96 && <rect x="8" y={y + 13} width="50" height="1.2" fill="#e5e7eb" />}
        </g>
      ))}
    </svg>
  );
}

/** Frise : ligne verticale et pastilles le long des entrées. */
function PreviewFrise({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="18" y="9" width="44" height="4.5" rx="0.5" fill={ink} />
      <rect x="26" y="16" width="28" height="2" rx="0.4" fill={accent} />
      <rect x="14" y="21" width="52" height="1.1" fill="#9ca3af" />
      {[29, 69].map((y, i) => (
        <g key={i}>
          <rect x="8" y={y} width="22" height="2.4" rx="0.3" fill={accent} />
          <rect x="10" y={y + 6} width="0.8" height="30" fill={accent} opacity="0.35" />
          {[0, 1, 2].map((k) => (
            <g key={k}>
              <circle cx="10.4" cy={y + 8 + k * 10} r="1.6" fill="white" stroke={accent} strokeWidth="0.8" />
              <rect x="15" y={y + 7 + k * 10} width="28" height="1.6" rx="0.3" fill={ink} />
              <rect x="15" y={y + 10 + k * 10} width="52" height="1.1" fill="#e5e7eb" />
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

/** Titres en marge : titre à gauche, contenu à droite le long d'un filet fin. */
function PreviewMarge({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="8" y="9" width="40" height="4.5" rx="0.5" fill={ink} />
      <rect x="8" y="16" width="26" height="2" rx="0.4" fill={accent} />
      <rect x="8" y="20.5" width="54" height="1.1" fill="#9ca3af" />
      {[28, 52, 74, 92].map((y, i) => (
        <g key={i}>
          <rect x="8" y={y} width="16" height="1.8" rx="0.3" fill={accent} />
          <rect x="27" y={y} width="0.5" height={i === 3 ? 10 : 18} fill={accent} opacity="0.4" />
          <rect x="30" y={y} width="28" height="1.6" rx="0.3" fill={ink} />
          <rect x="30" y={y + 3.5} width="42" height="1.1" fill="#e5e7eb" />
          <rect x="30" y={y + 6.5} width="38" height="1.1" fill="#e5e7eb" />
          {i !== 3 && <rect x="30" y={y + 11} width="26" height="1.6" rx="0.3" fill={ink} />}
          {i !== 3 && <rect x="30" y={y + 14.5} width="40" height="1.1" fill="#e5e7eb" />}
        </g>
      ))}
    </svg>
  );
}

/** Deux colonnes à filet : en-tête pleine largeur, colonne sans fond, filet vertical. */
function PreviewColonnesFilet({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="8" y="9" width="40" height="4.5" rx="0.5" fill={ink} />
      <rect x="8" y="16" width="26" height="2" rx="0.4" fill={accent} />
      <rect x="8" y="20.5" width="58" height="1.1" fill="#9ca3af" />
      <rect x="8" y="25" width="64" height="0.5" fill="#d1d5db" />
      <rect x="27" y="30" width="0.7" height="72" fill={accent} />
      {[30, 52, 74].map((y, i) => (
        <g key={i}>
          <rect x="8" y={y} width="14" height="1.6" rx="0.3" fill={accent} />
          {[0, 1, 2].map((k) => (
            <rect key={k} x="8" y={y + 4 + k * 3} width={k === 1 ? 12 : 15} height="1.1" fill="#e5e7eb" />
          ))}
        </g>
      ))}
      {[30, 56, 82].map((y, i) => (
        <g key={i}>
          <rect x="31" y={y} width="22" height="1.8" rx="0.3" fill={accent} />
          <rect x="31" y={y + 5} width="30" height="1.6" rx="0.3" fill={ink} />
          <rect x="31" y={y + 8.5} width="41" height="1.1" fill="#e5e7eb" />
          <rect x="31" y={y + 11.5} width="38" height="1.1" fill="#e5e7eb" />
          <rect x="31" y={y + 14.5} width="34" height="1.1" fill="#e5e7eb" />
        </g>
      ))}
    </svg>
  );
}

/** Étiquettes : titres dans une étiquette claire, entrées sur une ligne. */
function PreviewEtiquettes({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="8" y="9" width="38" height="4" rx="0.5" fill={ink} />
      <rect x="8" y="15.5" width="24" height="2" rx="0.4" fill={accent} />
      <rect x="8" y="20" width="54" height="1.1" fill="#9ca3af" />
      {[27, 52, 74, 92].map((y, i) => (
        <g key={i}>
          <rect x="8" y={y} width="24" height="4" rx="0.8" fill={accent} opacity="0.15" />
          <rect x="10" y={y + 1.2} width="18" height="1.6" rx="0.3" fill={accent} />
          {(i < 2 ? [0, 1] : [0]).map((k) => (
            <g key={k}>
              <rect x="8" y={y + 7 + k * 8} width="20" height="1.6" rx="0.3" fill={ink} />
              <rect x="29.5" y={y + 7 + k * 8} width="16" height="1.4" rx="0.3" fill="#9ca3af" />
              <rect x="60" y={y + 7 + k * 8} width="12" height="1.2" rx="0.3" fill="#9ca3af" />
              <rect x="10" y={y + 10.5 + k * 8} width="52" height="1.1" fill="#e5e7eb" />
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

/** Bandes claires : titres sur une bande pleine largeur, dates sous l'intitulé. */
function PreviewBandes({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="16" y="9" width="48" height="4.5" rx="0.5" fill={ink} />
      <rect x="24" y="16" width="32" height="2" rx="0.4" fill="#6b7280" />
      <rect x="14" y="20.5" width="52" height="1.1" fill="#9ca3af" />
      {[27, 55, 79, 95].map((y, i) => (
        <g key={i}>
          <rect x="8" y={y} width="64" height="4.5" fill={accent} opacity="0.15" />
          <rect x="10" y={y + 1.5} width="22" height="1.6" rx="0.3" fill={ink} />
          <rect x="8" y={y + 8} width="26" height="1.6" rx="0.3" fill={ink} />
          <rect x="8" y={y + 11.5} width="36" height="1.2" rx="0.3" fill="#9ca3af" />
          {i < 2 && <rect x="10" y={y + 15} width="54" height="1.1" fill="#e5e7eb" />}
          {i < 2 && <rect x="10" y={y + 18} width="48" height="1.1" fill="#e5e7eb" />}
        </g>
      ))}
    </svg>
  );
}

/** Lettre : aucun trait, titres en italique, entrées en retrait sous l'intitulé. */
function PreviewLettre({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="20" y="10" width="40" height="3.5" rx="0.5" fill={ink} />
      <rect x="28" y="16" width="24" height="1.8" rx="0.4" fill={accent} />
      <rect x="16" y="21" width="48" height="1.1" fill="#9ca3af" />
      {[30, 58, 82].map((y, i) => (
        <g key={i}>
          <rect x="8" y={y} width="22" height="2" rx="1" fill={accent} />
          {(i === 0 ? [0, 1] : [0]).map((k) => (
            <g key={k}>
              <rect x="8" y={y + 6 + k * 12} width="26" height="1.6" rx="0.3" fill={ink} />
              <rect x="12" y={y + 9.5 + k * 12} width="34" height="1.2" rx="0.3" fill="#9ca3af" />
              <rect x="14" y={y + 12.5 + k * 12} width="50" height="1.1" fill="#e5e7eb" />
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

/** Deux colonnes égales : parcours à gauche, formation et compétences à droite. */
function PreviewGrille({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="8" y="9" width="40" height="4.5" rx="0.5" fill={ink} />
      <rect x="8" y="16" width="26" height="2" rx="0.4" fill={accent} />
      <rect x="8" y="20.5" width="54" height="1.1" fill="#9ca3af" />
      <rect x="8" y="25" width="64" height="0.5" fill="#d1d5db" />
      {[0, 1].map((col) => (
        <g key={col}>
          <rect x={col ? 43 : 8} y="31" width="16" height="1.6" rx="0.3" fill={accent} />
          <rect x={col ? 43 : 8} y="33.6" width="29" height="0.7" fill={accent} />
        </g>
      ))}
      {[38, 56, 74].map((y) => (
        <g key={y}>
          <rect x="8" y={y} width="20" height="1.5" rx="0.3" fill={ink} />
          <rect x="8" y={y + 3.5} width="28" height="1.1" fill="#e5e7eb" />
          <rect x="8" y={y + 6.5} width="25" height="1.1" fill="#e5e7eb" />
          <rect x="8" y={y + 9.5} width="27" height="1.1" fill="#e5e7eb" />
        </g>
      ))}
      <rect x="43" y="38" width="22" height="1.5" rx="0.3" fill={ink} />
      <rect x="43" y="41.5" width="18" height="1.1" fill="#e5e7eb" />
      {[50, 66].map((y) => (
        <g key={y}>
          <rect x="43" y={y} width="16" height="1.6" rx="0.3" fill={accent} />
          <rect x="43" y={y + 2.6} width="29" height="0.7" fill={accent} />
          {[[43, 8], [53, 9], [64, 8], [43, 11]].map(([x, w], k) => (
            <rect key={k} x={x} y={y + 6 + Math.floor(k / 3) * 4.5} width={w} height="3" rx="0.8" fill={accent} opacity="0.18" />
          ))}
        </g>
      ))}
    </svg>
  );
}

/** Cartes : chaque entrée dans un cadre fin à liseré coloré. */
function PreviewCartes({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="18" y="9" width="44" height="4.5" rx="0.5" fill={ink} />
      <rect x="26" y="16" width="28" height="2" rx="0.4" fill={accent} />
      <rect x="14" y="20.5" width="52" height="1.1" fill="#9ca3af" />
      <rect x="8" y="27" width="26" height="1.8" rx="0.3" fill={accent} />
      {[32, 49, 66].map((y) => (
        <g key={y}>
          <rect x="8.3" y={y} width="63.4" height="14" rx="1.5" fill="white" stroke={accent} strokeOpacity="0.35" strokeWidth="0.6" />
          <rect x="8" y={y} width="1.4" height="14" rx="0.6" fill={accent} />
          <rect x="12" y={y + 3} width="26" height="1.6" rx="0.3" fill={ink} />
          <rect x="58" y={y + 3} width="11" height="1.2" rx="0.3" fill={accent} />
          <rect x="12" y={y + 7} width="50" height="1.1" fill="#e5e7eb" />
          <rect x="12" y={y + 10} width="44" height="1.1" fill="#e5e7eb" />
        </g>
      ))}
      <rect x="8" y="85" width="22" height="1.8" rx="0.3" fill={accent} />
      {[[8, 9], [19, 12], [33, 10], [45, 13]].map(([x, w], k) => (
        <rect key={k} x={x} y="90" width={w} height="3.2" rx="1.6" fill={accent} opacity="0.15" />
      ))}
    </svg>
  );
}

/** Monogramme : initiales dans un carré, titres en italique prolongés d'un filet. */
function PreviewMonogramme({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="8" y="8" width="13" height="13" fill={accent} fillOpacity="0.1" stroke={accent} strokeWidth="0.8" />
      <text x="14.5" y="17.2" textAnchor="middle" fontSize="6" fontFamily="Georgia, serif" fill={accent}>CM</text>
      <rect x="25" y="9" width="34" height="4.5" rx="0.5" fill={ink} />
      <rect x="25" y="15.5" width="20" height="1.6" rx="0.3" fill={accent} />
      <rect x="25" y="19" width="36" height="1.1" fill="#9ca3af" />
      {[29, 58, 84].map((y, i) => (
        <g key={i}>
          <rect x="8" y={y} width="20" height="2.2" rx="0.3" fill={accent} />
          <rect x="31" y={y + 1} width="41" height="0.4" fill={accent} opacity="0.5" />
          {(i === 0 ? [0, 1] : [0]).map((k) => (
            <g key={k}>
              <rect x="8" y={y + 6 + k * 12} width="14" height="1.1" rx="0.3" fill={accent} opacity="0.8" />
              <rect x="8" y={y + 8.5 + k * 12} width="28" height="1.6" rx="0.3" fill={ink} />
              <rect x="10" y={y + 12 + k * 12} width="54" height="1.1" fill="#e5e7eb" />
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

/** Magazine : très grand nom, filet épais, colonne large et encadré clair à droite. */
function PreviewMagazine({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="8" y="8" width="50" height="7" rx="0.6" fill={ink} />
      <rect x="8" y="17.5" width="24" height="1.6" rx="0.3" fill={accent} />
      <rect x="8" y="21" width="40" height="1.1" fill="#9ca3af" />
      <rect x="8" y="25" width="64" height="1.6" fill={accent} />
      {[31, 55, 79].map((y) => (
        <g key={y}>
          <rect x="8" y={y} width="20" height="2" rx="0.3" fill={ink} />
          <rect x="8" y={y + 5} width="22" height="1.5" rx="0.3" fill={ink} opacity="0.8" />
          <rect x="40" y={y + 5} width="7" height="1.2" rx="0.3" fill={accent} />
          <rect x="8" y={y + 8.5} width="38" height="1.1" fill="#e5e7eb" />
          <rect x="8" y={y + 11.5} width="34" height="1.1" fill="#e5e7eb" />
          <rect x="8" y={y + 14.5} width="36" height="1.1" fill="#e5e7eb" />
        </g>
      ))}
      <rect x="51" y="31" width="21" height="46" rx="2.5" fill={accent} opacity="0.1" />
      {[35, 38, 41, 44].map((y) => (
        <rect key={y} x="54" y={y} width="15" height="1.1" fill={accent} opacity="0.45" />
      ))}
      <rect x="54" y="50" width="12" height="1.6" rx="0.3" fill={ink} />
      {[[54, 54, 6], [61, 54, 7], [54, 58.5, 8]].map(([x, y, w], k) => (
        <rect key={k} x={x} y={y} width={w} height="3" rx="0.6" fill="white" stroke={accent} strokeOpacity="0.4" strokeWidth="0.4" />
      ))}
      <rect x="54" y="66" width="10" height="1.6" rx="0.3" fill={ink} />
      <rect x="54" y="70" width="14" height="3" rx="0.6" fill="white" stroke={accent} strokeOpacity="0.4" strokeWidth="0.4" />
    </svg>
  );
}

/** Surligneur : aplat clair sous le nom et les titres, dates en pastille. */
function PreviewSurligneur({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="7" y="11.5" width="42" height="3" fill={accent} opacity="0.28" />
      <rect x="8" y="8" width="40" height="5" rx="0.5" fill={ink} />
      <rect x="8" y="17" width="24" height="1.8" rx="0.3" fill={accent} />
      <rect x="8" y="21" width="42" height="1.1" fill="#9ca3af" />
      {[29, 58, 82].map((y, i) => (
        <g key={i}>
          <rect x="7" y={y + 1.4} width="28" height="2" fill={accent} opacity="0.28" />
          <rect x="8" y={y} width="26" height="2.4" rx="0.3" fill={ink} />
          {(i === 0 ? [0, 1] : [0]).map((k) => (
            <g key={k}>
              <rect x="8" y={y + 6.5 + k * 12} width="1.6" height="1.6" fill={accent} />
              <rect x="11" y={y + 6.5 + k * 12} width="24" height="1.6" rx="0.3" fill={ink} />
              <rect x="59" y={y + 6 + k * 12} width="13" height="2.6" rx="1.3" fill="white" stroke={accent} strokeWidth="0.4" />
              <rect x="10" y={y + 10 + k * 12} width="52" height="1.1" fill="#e5e7eb" />
              <rect x="10" y={y + 13 + k * 12} width="46" height="1.1" fill="#e5e7eb" />
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

/** Grand en-tête : bloc clair en haut, photo à cheval, tuiles en fin de page. */
function PreviewGrandEntete({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="0" y="0" width="80" height="24" fill={accent} opacity="0.12" />
      <rect x="22" y="6" width="36" height="4.5" rx="0.5" fill={ink} />
      <rect x="29" y="12.5" width="22" height="1.6" rx="0.3" fill={accent} />
      <rect x="20" y="16" width="40" height="1.1" fill="#9ca3af" />
      <circle cx="40" cy="24" r="6" fill="#cbd5e1" stroke="white" strokeWidth="1.2" />
      {[36, 60].map((y) => (
        <g key={y}>
          <rect x="8" y={y} width="22" height="1.8" rx="0.3" fill={accent} />
          <rect x="8" y={y + 3} width="64" height="0.5" fill={accent} opacity="0.3" />
          <rect x="8" y={y + 6} width="26" height="1.5" rx="0.3" fill={ink} />
          <rect x="8" y={y + 9.5} width="60" height="1.1" fill="#e5e7eb" />
          <rect x="8" y={y + 12.5} width="54" height="1.1" fill="#e5e7eb" />
          <rect x="8" y={y + 15.5} width="57" height="1.1" fill="#e5e7eb" />
        </g>
      ))}
      {[8, 30, 52].map((x) => (
        <g key={x}>
          <rect x={x} y="84" width="20" height="16" rx="1.6" fill={accent} opacity="0.12" />
          <rect x={x + 2.5} y="87" width="11" height="1.5" rx="0.3" fill={accent} />
          <rect x={x + 2.5} y="91.5" width="7" height="2.6" rx="1.3" fill="white" />
          <rect x={x + 10.5} y="91.5" width="7" height="2.6" rx="1.3" fill="white" />
        </g>
      ))}
    </svg>
  );
}

/** Frise centrale : ligne au centre, entrées alternées de part et d'autre. */
function PreviewFriseCentrale({ accent, ink = '#111827' }: PreviewProps) {
  return (
    <svg viewBox="0 0 80 110" className="w-full h-full">
      <rect width="80" height="110" fill="white" />
      <rect x="22" y="8" width="36" height="4.5" rx="0.5" fill={ink} />
      <rect x="29" y="15" width="22" height="1.6" rx="0.3" fill={accent} />
      <rect x="18" y="19" width="44" height="1.1" fill="#9ca3af" />
      <rect x="30" y="27" width="20" height="2" rx="0.3" fill={accent} />
      <rect x="39.6" y="33" width="0.8" height="56" fill={accent} opacity="0.4" />
      {[34, 50, 66, 82].map((y, i) => {
        const right = i % 2 === 0;
        return (
          <g key={y}>
            <circle cx="40" cy={y + 1} r="1.6" fill="white" stroke={accent} strokeWidth="0.7" />
            <rect x={right ? 26 : 45} y={y + 0.4} width="10" height="1.2" rx="0.3" fill={accent} />
            <rect x={right ? 45 : 10} y={y} width="22" height="1.6" rx="0.3" fill={ink} />
            <rect x={right ? 45 : 10} y={y + 3.5} width="26" height="1.1" fill="#e5e7eb" />
            <rect x={right ? 45 : 10} y={y + 6.5} width="22" height="1.1" fill="#e5e7eb" />
          </g>
        );
      })}
      <rect x="30" y="94" width="20" height="2" rx="0.3" fill={accent} />
      {[[17, 9], [28, 12], [42, 10], [54, 9]].map(([x, w], k) => (
        <rect key={k} x={x} y="99" width={w} height="3" rx="1.5" fill={accent} opacity="0.15" />
      ))}
    </svg>
  );
}

const TEMPLATE_PREVIEWS: Record<string, React.ComponentType<PreviewProps>> = {
  'ats-classic':     PreviewClassic,
  'ats-modern':      PreviewModern,
  'elegant':         PreviewElegant,
  'minimalist':      PreviewMinimalist,
  'tech':            PreviewTech,
  'executive':       PreviewExecutive,
  'creative':        PreviewCreative,
  'academic':        PreviewAcademic,
  'sidebar-modern':  PreviewSidebarModern,
  'sidebar-tech':    PreviewSidebarTech,
  'sidebar-elegant': PreviewSidebarElegant,
  'ats-chrono':      PreviewChrono,
  'ats-scinde':      PreviewScinde,
  'ats-frise':       PreviewFrise,
  'marge':           PreviewMarge,
  'colonnes-filet':  PreviewColonnesFilet,
  'ats-etiquettes':  PreviewEtiquettes,
  'ats-bandes':      PreviewBandes,
  'ats-lettre':      PreviewLettre,
  'grille':          PreviewGrille,
  'cartes':          PreviewCartes,
  'monogramme':      PreviewMonogramme,
  'magazine':        PreviewMagazine,
  'surligneur':      PreviewSurligneur,
  'grand-entete':    PreviewGrandEntete,
  'frise-centrale':  PreviewFriseCentrale,
};

// ── Composant principal ────────────────────────────────────────────────────

const CATEGORY_ORDER: TemplateCategory[] = ['ats', 'executive', 'tech', 'creative', 'academic', 'graphic'];

export function TemplatePickerPopover({ currentTemplateId, onSelect }: TemplatePickerPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const handle = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handle);
    return () => mq.removeEventListener('change', handle);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerOutside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerOutside);
    return () => document.removeEventListener('pointerdown', handlePointerOutside);
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
        zIndex: 100,
        maxHeight: `calc(100vh - ${rect.bottom + 24}px)`,
        overflowY: 'auto',
      });
    }
    setIsOpen(v => !v);
  };

  const allTemplates = getAllTemplates();
  const current = getTemplate(currentTemplateId);

  return (
    <div ref={containerRef}>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="bg-gray-50 dark:bg-[var(--pc-bg)] border border-gray-300 dark:border-[var(--pc-border)] text-gray-900 dark:text-[var(--pc-text)] text-sm rounded-md focus:ring-lagon-500 focus:border-lagon-500 px-3 py-2 flex items-center gap-1.5 hover:bg-gray-100 transition-colors min-h-[44px]"
      >
        <span className="text-gray-500 dark:text-[var(--pc-muted)] text-xs hidden sm:inline">Modèle :</span>
        <span className="font-medium">{current.name}</span>
        <ChevronDown className="w-4 h-4 text-gray-400 dark:text-[var(--pc-muted)]" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop mobile/desktop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[90] animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
          />

          <div
            ref={dropdownRef}
            style={isMobile ? {} : dropdownStyle}
            className={`
              bg-white dark:bg-[var(--pc-card)] border border-gray-200 dark:border-[var(--pc-border)] shadow-2xl z-[100] flex flex-col
              ${isMobile 
                ? 'fixed inset-x-0 bottom-0 rounded-t-2xl max-h-[85vh] animate-in slide-in-from-bottom duration-300' 
                : 'rounded-xl w-[620px] max-w-[720px] max-h-[85vh]'
              }
            `}
          >
            {isMobile && (
              <div className="flex flex-col items-center py-3 shrink-0">
                <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full mb-2" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-[var(--pc-text)]">Choisir un modèle</h3>
              </div>
            )}

            <div className={`p-4 overflow-y-auto ${isMobile ? 'pb-12' : ''}`}>
              {CATEGORY_ORDER.map(cat => {
                const items = allTemplates.filter(t => t.category === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat} className="mb-4 last:mb-0">
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-[var(--pc-muted)]">
                        {CATEGORY_LABELS[cat]}
                      </span>
                      <span className="flex-1 h-px bg-gray-200 dark:bg-[var(--pc-surface)]" />
                    </div>
                    {CATEGORY_HINTS[cat] && (
                      <p className="text-[10.5px] text-amber-700 dark:text-amber-400 px-1 mb-2 leading-snug">
                        {CATEGORY_HINTS[cat]}
                      </p>
                    )}
                    <div className={`grid gap-2.5 ${isMobile ? 'grid-cols-2' : 'grid-cols-4'}`}>
                      {items.map(template => {
                        const Preview = TEMPLATE_PREVIEWS[template.id];
                        const isActive = template.id === currentTemplateId;
                        const accent = template.palettes?.[0]?.accent || '#1f2937';
                        const ink = template.palettes?.[0]?.ink || '#111827';
                        return (
                          <button
                            key={template.id}
                            onClick={() => {
                              onSelect(template.id);
                              setIsOpen(false);
                            }}
                            className="flex flex-col items-center gap-1.5 group rounded-lg p-2 hover:bg-gray-50 dark:hover:bg-[var(--pc-hover)]/50 transition-colors"
                          >
                            <div
                              className={`relative w-full aspect-[80/110] rounded-md border-2 overflow-hidden transition-colors ${
                                isActive
                                  ? 'border-lagon-500 ring-2 ring-lagon-200'
                                  : 'border-gray-200 dark:border-[var(--pc-border)] group-hover:border-lagon-300 bg-white dark:bg-[var(--pc-card)]'
                              }`}
                              style={isActive ? {} : { background: 'white' }}
                            >
                              {Preview && <Preview accent={accent} ink={ink} />}
                              {template.atsOptimized === false && (
                                <span
                                  className="absolute top-1 right-1 px-1 py-px text-[8px] font-bold uppercase tracking-wide rounded bg-amber-500 text-white shadow-sm"
                                  title="CV graphique — destiné à un recruteur humain, non optimisé pour les filtres ATS"
                                >
                                  Non-ATS
                                </span>
                              )}
                            </div>
                            <span className={`text-[11px] font-medium text-center leading-tight ${
                              isActive
                                ? 'text-lagon-600 dark:text-lagon-400'
                                : 'text-gray-700 dark:text-[var(--pc-muted)]'
                            }`}>
                              {template.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
