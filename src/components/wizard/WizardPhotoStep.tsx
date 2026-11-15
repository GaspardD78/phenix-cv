import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, ImagePlus, Trash2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhotoCropModal } from '@/components/profile/PhotoCropModal';
import { useProfileStore } from '@/stores/profileStore';
import { useWizardStore } from '@/stores/wizardStore';
import { ACCEPTED_PHOTO_TYPES, PHOTO_TIPS, photoContinue, validatePhotoFile } from '@/lib/wizard/photo';

/** Écran 5 : photo facultative, recadrée avec l'outil de « Mon profil ». */
export function WizardPhotoStep() {
  const profile = useProfileStore(s => s.profile);
  const fetchProfile = useProfileStore(s => s.fetchProfile);
  const updateProfile = useProfileStore(s => s.updateProfile);
  const complete = useWizardStore(s => s.complete);
  const skip = useWizardStore(s => s.skip);
  const back = useWizardStore(s => s.back);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void fetchProfile(); }, [fetchProfile]);

  const hasPhoto = Boolean(profile?.photoPath);
  const next = photoContinue(hasPhoto);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const problem = validatePhotoFile(file);
    setError(problem);
    if (!problem) setCropSrc(URL.createObjectURL(file));
  };

  const closeCrop = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const onCropConfirm = async (base64: string) => {
    closeCrop();
    setSaving(true);
    try {
      await updateProfile({ photoPath: base64 });
    } catch {
      toast.error("La photo n'a pas pu être enregistrée.");
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async () => {
    setSaving(true);
    try {
      await updateProfile({ photoPath: null });
    } catch {
      toast.error("La photo n'a pas pu être retirée.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Ajoutez une photo (facultatif)</h1>
        <p className="text-muted-foreground">
          La photo n'est pas obligatoire : beaucoup de CV s'en passent. Si vous en mettez une, choisissez-la sobre.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center">
          {hasPhoto ? (
            <img src={profile?.photoPath ?? ''} alt="Votre photo" className="size-32 rounded-full border-2 border-border object-cover" />
          ) : (
            <div className="flex size-32 items-center justify-center rounded-full border-2 border-dashed border-border bg-muted" aria-hidden>
              <UserRound className="size-14 text-muted-foreground" />
            </div>
          )}
          <input ref={inputRef} type="file" accept={ACCEPTED_PHOTO_TYPES.join(',')} className="hidden" onChange={onFile} aria-label="Choisir une photo" />
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => inputRef.current?.click()} disabled={saving} variant={hasPhoto ? 'outline' : 'default'}>
              <ImagePlus className="size-4" aria-hidden />{hasPhoto ? 'Changer la photo' : 'Choisir une photo'}
            </Button>
            {hasPhoto && (
              <Button variant="ghost" onClick={() => void onRemove()} disabled={saving}>
                <Trash2 className="size-4" aria-hidden />Retirer la photo
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">JPEG, PNG ou WebP, 10 Mo au plus. Vous pourrez la recadrer.</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-3 font-semibold">Nos conseils</h2>
          <ul className="space-y-2 text-sm">
            {PHOTO_TIPS.map(tip => (
              <li key={tip} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void back()}><ArrowLeft className="size-4" aria-hidden />Retour</Button>
          <Button variant="ghost" onClick={() => navigate('/')}>Quitter le guide</Button>
        </div>
        <Button onClick={() => void (next.action === 'complete' ? complete() : skip())} disabled={saving}>
          {next.label} <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>

      {cropSrc && <PhotoCropModal imageSrc={cropSrc} onConfirm={b => void onCropConfirm(b)} onCancel={closeCrop} />}
    </>
  );
}
