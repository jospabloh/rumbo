import { useState } from 'react';
import { Paperclip, X, FileText, Link as LinkIcon, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { compressImage } from '@/lib/imageUtils';

const ACCEPT = 'image/*,application/pdf,.doc,.docx,.txt,text/plain';

/**
 * Compositor de notas de bitácora (UnitDayNote) con adjuntos mixtos —
 * imagen/PDF/DOCX/TXT, subidos por archivo, pegados desde el portapapeles
 * (primera interacción de este tipo en la app), o referenciados por URL.
 * Los adjuntos se juntan en el cliente y se guardan junto con el texto en un
 * solo `create()` — nunca por separado — para no necesitar permiso de update.
 *
 * @param {{ onSave: (text: string, attachments: {file_url:string,file_name:string,file_type:string}[]) => Promise<void> }} props
 */
export default function NoteComposer({ onSave }) {
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const toUpload = file.type.startsWith('image/') ? await compressImage(file) : file;
        const { file_url } = await base44.integrations.Core.UploadFile({ file: toUpload });
        setAttachments((prev) => [...prev, { file_url, file_name: file.name, file_type: file.type }]);
      }
    } finally {
      setUploading(false);
    }
  };

  // Pegar una captura/imagen directamente en el textarea — convierte el blob
  // del portapapeles en un File y lo manda por el mismo camino que un adjunto
  // subido por archivo, para no duplicar la lógica de compresión/subida.
  const handlePaste = (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((it) => it.kind === 'file' && it.type.startsWith('image/'));
    if (!imageItem) return; // deja pegar texto normal
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (file) handleFiles([file]);
  };

  const addLink = () => {
    const raw = linkValue.trim();
    if (!raw) return;
    // Solo se admiten esquemas http/https: un `javascript:` o `data:` aquí se
    // persiste en la nota y se ejecuta en la sesión de quien la lea después (XSS
    // almacenado). Si no trae esquema, se antepone https://; si trae uno no
    // permitido, se descarta.
    let url = raw;
    if (!/^https?:\/\//i.test(url)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
        setLinkValue('');
        return; // esquema no seguro (javascript:, data:, etc.)
      }
      url = `https://${url}`;
    }
    setAttachments((prev) => [...prev, { file_url: url, file_name: url.split('/').pop() || 'enlace', file_type: 'link' }]);
    setLinkValue('');
    setLinkOpen(false);
  };

  const removeAttachment = (idx) => setAttachments((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!draft.trim()) return; // `text` es requerido en UnitDayNote — los adjuntos van siempre con una nota
    setSaving(true);
    try {
      await onSave(draft.trim(), attachments);
      setDraft('');
      setAttachments([]);
    } finally {
      setSaving(false);
    }
  };

  const disabled = saving || uploading || !draft.trim();

  return (
    <div className="mt-2 space-y-2">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onPaste={handlePaste}
        placeholder="Agregar nota para esta unidad... (puedes pegar una imagen)"
        className="min-h-16 text-sm bg-background"
      />
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-xs bg-secondary rounded-full pl-1 pr-1.5 py-0.5">
              {a.file_type?.startsWith('image/')
                ? <img src={a.file_url} alt={a.file_name} className="w-5 h-5 rounded-full object-cover" />
                : <FileText className="w-3.5 h-3.5 text-muted-foreground" />}
              <span className="max-w-[8rem] truncate">{a.file_name}</span>
              <button type="button" onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {linkOpen && (
        <div className="flex gap-2">
          <Input value={linkValue} onChange={(e) => setLinkValue(e.target.value)} placeholder="https://..." className="h-8 text-sm bg-background" />
          <Button size="sm" variant="outline" onClick={addLink} className="shrink-0">Agregar</Button>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <label className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer px-2 py-1 rounded-md hover:bg-accent">
            <Paperclip className="w-3.5 h-3.5" />{uploading ? 'Subiendo...' : 'Adjuntar'}
            <input type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => handleFiles(e.target.files)} disabled={uploading} />
          </label>
          <button type="button" onClick={() => setLinkOpen((v) => !v)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-accent">
            <LinkIcon className="w-3.5 h-3.5" />Enlace
          </button>
        </div>
        <Button size="sm" variant="outline" onClick={handleSubmit} disabled={disabled} className="gap-1 shrink-0">
          <MessageSquarePlus className="w-3.5 h-3.5" />Guardar
        </Button>
      </div>
    </div>
  );
}