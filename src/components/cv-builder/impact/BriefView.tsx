import { useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { AlertTriangle, ExternalLink, Plus, RefreshCw, X } from 'lucide-react';
import {
  BRIEF_LISTS, BRIEF_LIST_LABELS, STALE_AFTER_DAYS, addBriefItem, briefAgeDays, briefIsStale, removeBriefItem,
  type BriefItem, type BriefList, type BriefReport, type TargetBrief,
} from '@/lib/target-brief';

const CONFIDENCE: Record<BriefItem['confidence'], { label: string; cls: string }> = {
  officiel: { label: 'officiel', cls: 'bg-green-100 text-green-800' },
  confirme: { label: 'confirmé', cls: 'bg-sky-100 text-sky-800' },
  'source-unique': { label: 'une seule source', cls: 'bg-gray-100 text-gray-700' },
};

export async function openSource(url: string): Promise<void> {
  try { await openUrl(url); } catch { window.open(url, '_blank', 'noopener,noreferrer'); }
}

const longDate = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};

interface BriefViewProps {
  brief: TargetBrief;
  /** Rapport du contrôle, juste après la lecture d'une réponse (absent pour une fiche en cache). */
  report?: BriefReport | null;
  onChange: (brief: TargetBrief) => void;
  onRefresh: () => void;
  now?: Date;
}

function Chip({ item, onRemove }: { item: BriefItem; onRemove: () => void }) {
  const c = CONFIDENCE[item.confidence];
  return (
    <li className="flex items-start gap-1.5 text-xs py-0.5">
      <span className="flex-1 min-w-0">{item.text}</span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${c.cls}`} title={`Sources : ${item.sources.join(', ')}`}>{c.label}</span>
      <button type="button" onClick={onRemove} aria-label={`Retirer « ${item.text} »`} className="text-gray-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
    </li>
  );
}

function AddField({ onAdd, label }: { onAdd: (text: string) => void; label: string }) {
  const [text, setText] = useState('');
  const submit = () => { if (text.trim()) { onAdd(text); setText(''); } };
  return (
    <div className="flex gap-1 mt-1">
      <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        placeholder="Ajouter…" aria-label={`Ajouter à « ${label} »`}
        className="flex-1 min-w-0 p-1 border border-gray-300 dark:border-[var(--pc-border)] rounded text-xs bg-white dark:bg-[var(--pc-card)]" />
      <button type="button" onClick={submit} disabled={!text.trim()} aria-label={`Valider l'ajout à « ${label} »`} className="px-1.5 text-gray-600 border border-gray-300 rounded disabled:opacity-40"><Plus className="w-3.5 h-3.5" /></button>
    </div>
  );
}

/** Fiche « Ce que le marché attend » : lisible, corrigeable (retirer, ajouter), avec ses sources cliquables. */
export function BriefView({ brief, report, onChange, onRefresh, now = new Date() }: BriefViewProps) {
  const stale = briefIsStale(brief, now);
  const days = briefAgeDays(brief, now);
  const staleSources = new Set((report?.staleSources ?? []).map(s => s.id));
  const sections: { key: BriefList | 'skills'; items: BriefItem[] }[] = [
    { key: 'skills', items: brief.skills },
    ...BRIEF_LISTS.filter(k => k !== 'titleVariants').map(k => ({ key: k, items: brief[k] })),
  ];
  return (
    <div className="space-y-3" data-testid="brief-view">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">Ce que le marché attend</h3>
          <p className="text-[11px] text-gray-500 dark:text-[var(--pc-muted)]">Fiche du {longDate(brief.researchedAt)}{brief.sources.length ? ` · ${brief.sources.length} source${brief.sources.length > 1 ? 's' : ''}` : ''}</p>
        </div>
        <button type="button" onClick={onRefresh} className="flex items-center gap-1 text-xs text-amber-700 hover:underline" data-testid="brief-refresh">
          <RefreshCw className="w-3.5 h-3.5" aria-hidden /> Actualiser
        </button>
      </div>

      {stale && (
        <p className="text-xs rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-2" data-testid="brief-stale">
          Cette fiche date de {days} jours (plus de {STALE_AFTER_DAYS}). Cliquez sur « Actualiser » pour refaire la recherche.
        </p>
      )}
      {report?.singleDomain && (
        <p className="text-xs rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-2 flex gap-1.5" data-testid="brief-single-domain">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden />
          Toutes les sources viennent d'un seul site ({report.domains[0]}). Vérifiez ce qui compte pour vous, ou refaites la recherche.
        </p>
      )}
      {report && (report.removed.length > 0 || report.droppedSources.length > 0 || report.staleSources.length > 0) && (
        <details className="text-xs rounded-md border border-gray-200 p-2" data-testid="brief-report">
          <summary className="cursor-pointer font-semibold">
            Contrôle de la réponse : {report.removed.length} élément{report.removed.length > 1 ? 's' : ''} écarté{report.removed.length > 1 ? 's' : ''}, {report.droppedSources.length} source{report.droppedSources.length > 1 ? 's' : ''} écartée{report.droppedSources.length > 1 ? 's' : ''}
          </summary>
          <ul className="mt-1 space-y-0.5 list-disc ml-4">
            {report.removed.map((r, i) => <li key={`r${i}`}>« {r.text} » : {r.reason}.</li>)}
            {report.droppedSources.map((d, i) => <li key={`d${i}`}>Source écartée ({d.reason}) : {d.url || 'adresse vide'}.</li>)}
            {report.staleSources.map(s => <li key={s.id}>{s.site} : {s.reason} (gardée, à prendre avec précaution).</li>)}
          </ul>
        </details>
      )}

      <section>
        <h4 className="text-xs font-semibold">{BRIEF_LIST_LABELS.title}</h4>
        {brief.title ? <ul><Chip item={brief.title} onRemove={() => onChange({ ...brief, title: null })} /></ul> : <p className="text-xs text-gray-500">Aucun intitulé trouvé.</p>}
        <ul>{brief.titleVariants.map((v, i) => <Chip key={i} item={v} onRemove={() => onChange(removeBriefItem(brief, 'titleVariants', i))} />)}</ul>
        <AddField label={BRIEF_LIST_LABELS.titleVariants} onAdd={t => onChange(addBriefItem(brief, 'titleVariants', t))} />
      </section>

      <section>
        <h4 className="text-xs font-semibold">{BRIEF_LIST_LABELS.skills}</h4>
        <ul>
          {brief.skills.map((s, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs py-0.5">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.level === 'indispensable' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'}`}>{s.level === 'indispensable' ? 'indispensable' : 'plus'}</span>
              <span className="flex-1 min-w-0">{s.text}{s.kind !== 'competence' ? <em className="text-gray-500"> ({s.kind === 'outil' ? 'outil' : 'certification'})</em> : null}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${CONFIDENCE[s.confidence].cls}`}>{CONFIDENCE[s.confidence].label}</span>
              <button type="button" onClick={() => onChange(removeBriefItem(brief, 'skills', i))} aria-label={`Retirer « ${s.text} »`} className="text-gray-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ul>
        <AddField label={BRIEF_LIST_LABELS.skills} onAdd={t => onChange(addBriefItem(brief, 'skills', t))} />
      </section>

      {sections.filter(s => s.key !== 'skills').map(({ key, items }) => (
        <section key={key}>
          <h4 className="text-xs font-semibold">{BRIEF_LIST_LABELS[key]}</h4>
          <ul>{items.map((it, i) => <Chip key={i} item={it} onRemove={() => onChange(removeBriefItem(brief, key as BriefList, i))} />)}</ul>
          <AddField label={BRIEF_LIST_LABELS[key]} onAdd={t => onChange(addBriefItem(brief, key as BriefList, t))} />
        </section>
      ))}

      <section>
        <h4 className="text-xs font-semibold">Sources</h4>
        <ul className="space-y-0.5">
          {brief.sources.filter(s => s.id !== 'vous').map(s => (
            <li key={s.id} className="text-xs flex items-center gap-1.5">
              <button type="button" onClick={() => void openSource(s.url)} className="text-amber-700 hover:underline inline-flex items-center gap-1 text-left" title={s.url}>
                {s.site}{s.titre ? ` : ${s.titre}` : ''} <ExternalLink className="w-3 h-3" aria-hidden />
              </button>
              <span className="text-gray-500">({s.datePublication ? `publiée ${s.datePublication}` : `consultée le ${s.dateConsultation}`}){staleSources.has(s.id) ? ' · ancienne' : ''}</span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-gray-500 mt-1">Les sources ne figurent jamais dans votre CV. Ouvrez-les pour vérifier ce qui vous semble douteux.</p>
      </section>
    </div>
  );
}
