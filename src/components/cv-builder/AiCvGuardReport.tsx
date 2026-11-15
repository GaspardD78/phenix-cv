import { AlertTriangle, CheckCircle2, Lightbulb, OctagonAlert } from 'lucide-react';
import type { GuardReport } from '@/lib/ai-cv-guard';
import { warningsLabel } from '@/lib/cv-focus-rules';

interface AiCvGuardReportProps {
  report: GuardReport;
}

/** Bloc titré du rapport : un titre clair, puis son contenu en texte lisible (jamais de jargon). */
function Block({ icon, title, tone, children, testId }: {
  icon: React.ReactNode; title: string; tone: 'red' | 'amber' | 'sky' | 'gray'; children: React.ReactNode; testId?: string;
}) {
  const tones = {
    red: 'border-red-200 bg-red-50 text-red-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    sky: 'border-sky-200 bg-sky-50 text-sky-900',
    gray: 'border-gray-200 dark:border-[var(--pc-border)] bg-white dark:bg-[var(--pc-card)] text-gray-800 dark:text-[var(--pc-text)]',
  } as const;
  return (
    <section className={`rounded-lg border p-3 ${tones[tone]}`} data-testid={testId}>
      <h4 className="flex items-center gap-2 text-sm font-semibold mb-1.5">{icon}{title}</h4>
      <div className="text-sm leading-relaxed space-y-1.5">{children}</div>
    </section>
  );
}

const List = ({ items }: { items: string[] }) => (
  <ul className="list-disc pl-5 space-y-1">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
);

/**
 * Rapport de contrôle d'un CV préparé par une IA, en langage courant :
 * verdict d'abord, puis ce qui bloque, ce qui est à savoir, puis les conseils et questions de l'IA.
 * L'écran appelant adapte son bouton (« Appliquer quand même ») quand `report.errors` n'est pas vide.
 */
export function AiCvGuardReport({ report }: AiCvGuardReportProps) {
  const { keywordCoverage: cov, ecarts, estimatedLines, pageBudget, visibleBullets, overflow } = report.metrics;
  const hasErrors = report.errors.length > 0;
  const pages = `${pageBudget} page${pageBudget > 1 ? 's' : ''}`;

  return (
    <div className="space-y-3" data-testid="ai-cv-guard-report">
      <div
        className={`rounded-lg border p-3 flex items-start gap-2 ${
          hasErrors ? 'border-red-300 bg-red-50 text-red-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900'
        }`}
      >
        {hasErrors ? <OctagonAlert className="w-5 h-5 mt-0.5 shrink-0 text-red-500" /> : <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-emerald-600" />}
        <div className="text-sm">
          <p className="font-semibold">{hasErrors ? "À vérifier avant d'appliquer" : 'Tout est en ordre : vous pouvez appliquer'}</p>
          <p className="mt-0.5 text-xs opacity-90">
            {cov.pct !== null && <>Mots importants de l'annonce retrouvés : {cov.found} sur {cov.total} ({cov.pct} %). </>}
            Longueur : environ {estimatedLines} lignes et {visibleBullets} puces, pour {pages} visée{pageBudget > 1 ? 's' : ''}.
          </p>
        </div>
      </div>

      {hasErrors && (
        <Block icon={<OctagonAlert className="w-4 h-4" />} title="Points à corriger" tone="red">
          <List items={report.errors.map(e => e.message)} />
        </Block>
      )}

      {overflow.exceedsTarget && (
        <Block
          icon={<AlertTriangle className="w-4 h-4" />}
          tone="amber"
          testId="ai-cv-overflow"
          title={`Dépasse probablement ${pages} (environ ${overflow.excessLines} ligne${overflow.excessLines > 1 ? 's' : ''} en trop)`}
        >
          {overflow.removalCandidates.length > 0 && (
            <>
              <p>À retirer en priorité :</p>
              <ol className="list-decimal pl-5 space-y-0.5">
                {overflow.removalCandidates.map((c, i) => (
                  <li key={i}>{c.label} <span className="opacity-75">({c.reason}, environ {c.savedLines} ligne{c.savedLines > 1 ? 's' : ''})</span></li>
                ))}
              </ol>
            </>
          )}
        </Block>
      )}

      {(cov.missing.length > 0 || ecarts.length > 0) && (
        <Block icon={<Lightbulb className="w-4 h-4" />} title="Ce que l'annonce demande et que votre profil ne montre pas" tone="gray">
          {cov.missing.length > 0 && <p><span className="font-medium">Mots importants absents du CV :</span> {cov.missing.join(', ')}.</p>}
          {ecarts.length > 0 && <p><span className="font-medium">Exigences non couvertes :</span> {ecarts.join(', ')}.</p>}
          <p className="text-xs text-gray-500 dark:text-[var(--pc-muted)]">Si c'est vrai pour vous, ajoutez-le dans « Mon profil » : rien n'est ajouté sans votre accord.</p>
        </Block>
      )}

      {report.angle && (
        <p className="text-sm text-gray-700 dark:text-[var(--pc-text)]" data-testid="ai-cv-angle">
          <span className="font-medium">Mise en avant choisie :</span> {report.angle.label}
        </p>
      )}

      {report.metrics.alertesCap.length > 0 && (
        <Block icon={<AlertTriangle className="w-4 h-4" />} tone="amber" testId="ai-cv-alertes-cap"
          title="L'annonce contredit vos critères de recherche (rien n'est bloqué)">
          <List items={report.metrics.alertesCap} />
        </Block>
      )}

      {report.aiWarnings.length > 0 && (
        <Block icon={<Lightbulb className="w-4 h-4" />} title={warningsLabel(report.focus) || "Conseils et questions de l'IA"} tone="sky">
          <List items={report.aiWarnings} />
          <p className="text-xs opacity-80">Ce sont des pistes : répondez-y en complétant « Mon profil », puis recommencez si vous le souhaitez.</p>
        </Block>
      )}

      {report.warnings.length > 0 && (
        <Block icon={<AlertTriangle className="w-4 h-4" />} tone="amber"
          title={`À savoir (${report.warnings.length})`}>
          <List items={report.warnings.map(w => w.message)} />
        </Block>
      )}
    </div>
  );
}
