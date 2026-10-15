import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/** Confirmation used before every destructive or irreversible action. */
export function ConfirmDialog({
  open,
  title,
  message,
  detail,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [working, setWorking] = useState(false);

  const handleConfirm = async () => {
    setWorking(true);
    try {
      await onConfirm();
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={working ? () => undefined : onCancel}
      title={title}
      size="sm"
      closeOnOverlay={false}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={working}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={handleConfirm}
            loading={working}
            data-autofocus
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-base text-ink">{message}</p>
      {detail ? <p className="mt-2 text-sm text-muted">{detail}</p> : null}
    </Modal>
  );
}
