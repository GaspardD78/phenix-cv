import { Check, X } from 'lucide-react';
import type { AiCvResponse } from '@/lib/ai-cv-response';

interface PositioningReportProps {
  data: Pick<AiCvResponse, 'rapport' | 'suggestions' | 'decisions'>;
  /** Mots-clés déjà confirmés par la personne (terme). */
  confirmed: ReadonlySet<string>;
  refused: ReadonlySet<string>;
  onConfirm: (term: string) => void;
  onRefuse: (term: string) => void;
}

/**
 * Rapport de positionnement (pourquoi cet intitulé, ces compétences, ce qui a été reformulé ou écarté) et
 * suggestions non retenues dans le CV. Confirmer un mot-clé, c'est affirmer qu'on le maîtrise : il devient
 * une réponse de la personne, source au même titre que le profil. Rien n'est écrit dans le CV ici.
 */
export function PositioningReport({ data, confirmed, refused, onConfirm, onRefuse }: PositioningReportProps) {
  const { rapport, suggestions } = data;
  if (!rapport && !suggestions) return null;
  return (
    <div className="space-y-3" data-testid="positioning-report">
      {rapport && (
        <section className="rounded-lg border border-gray-200 dark:border-[var(--pc-border)] p-3 space-y-2 text-xs">
          <h4 className="text-sm font-bold">Pourquoi ce CV</h4>
          {rapport.intitule && <p><strong>Intitulé :</strong> {rapport.intitule}</p>}
          {rapport.competences && <p><strong>Compétences :</strong> {rapport.competences}</p>}
          {rapport.reformule.length > 0 && (
            <div>
              <strong>Reformulé dans les mots du métier :</strong>
              <ul className="list-disc ml-4 mt-0.5">
                {rapport.reformule.map((r, i) => <li key={i}>« {r.avant} » devient « {r.apres} »{r.pourquoi ? ` : ${r.pourquoi}` : ''}</li>)}
              </ul>
            </div>
          )}
          {rapport.ecarte.length > 0 && (
            <div>
              <strong>Écarté ou condensé :</strong>
              <ul className="list-disc ml-4 mt-0.5">{rapport.ecarte.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
          )}
        </section>
      )}
      {suggestions && suggestions.motsCles.length > 0 && (
        <section className="rounded-lg border border-sky-200 bg-sky-50 dark:bg-[var(--pc-accent-subtle)] p-3 space-y-2 text-xs" data-testid="keyword-suggestions">
          <h4 className="text-sm font-bold">Mots du marché que votre profil ne montre pas</h4>
          <p>Ils ne sont pas dans votre CV, ou y sont signalés. Confirmez seulement ceux que vous maîtrisez vraiment : une fois confirmé, le mot compte comme une information venant de vous.</p>
          <ul className="space-y-1.5">
            {suggestions.motsCles.map(m => {
              const yes = confirmed.has(m.terme);
              const no = refused.has(m.terme);
              return (
                <li key={m.terme} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold">{m.terme}</span>{m.raison ? <span className="text-gray-600"> : {m.raison}</span> : null}
                    {yes && <p className="text-green-700">Confirmé : il peut figurer dans votre CV.</p>}
                    {no && <p className="text-gray-600">Refusé : si ce mot est dans le CV, retirez-le avec « Répondre aux remarques ».</p>}
                  </div>
                  <button type="button" onClick={() => onConfirm(m.terme)} disabled={yes} className="pc-btn-secondary" aria-label={`Confirmer « ${m.terme} »`}><Check className="w-3.5 h-3.5" aria-hidden /> Je le maîtrise</button>
                  <button type="button" onClick={() => onRefuse(m.terme)} disabled={no} className="pc-btn-secondary" aria-label={`Refuser « ${m.terme} »`}><X className="w-3.5 h-3.5" aria-hidden /> Non</button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {suggestions && suggestions.formations.length > 0 && (
        <section className="rounded-lg border border-gray-200 p-3 text-xs space-y-1" data-testid="training-suggestions">
          <h4 className="text-sm font-bold">À envisager (rien n'est ajouté à votre CV)</h4>
          <ul className="list-disc ml-4">{suggestions.formations.map((f, i) => <li key={i}>{f.libelle}{f.raison ? ` : ${f.raison}` : ''}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
