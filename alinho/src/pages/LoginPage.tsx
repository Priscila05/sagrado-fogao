import { useState } from 'react';
import { AlertTriangle, LogIn, Mail } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/ui/Button';
import { TextInput } from '../components/ui/Field';
import { LogoLockup } from '../design/Logo';

/** Entrada da versão em equipe. Não existe cadastro público: o acesso é criado
 *  pelo administrador no painel do Supabase. */
export function LoginPage() {
  const { signIn, sendPasswordReset, error, status } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLocalError(null);
    setNotice(null);
    if (!email.trim() || !password) {
      setLocalError('Informe e-mail e senha.');
      return;
    }
    setWorking(true);
    try {
      const result = await signIn(email, password);
      if (!result.ok) setLocalError(result.error ?? 'Não foi possível entrar.');
    } catch {
      setLocalError('Não foi possível falar com o servidor. Verifique sua conexão.');
    } finally {
      setWorking(false);
    }
  };

  const handleReset = async () => {
    setLocalError(null);
    setNotice(null);
    if (!email.trim()) {
      setLocalError('Digite seu e-mail para receber o link de redefinição.');
      return;
    }
    setWorking(true);
    try {
      const result = await sendPasswordReset(email);
      if (result.ok) {
        setNotice('Se este e-mail tiver acesso, você receberá um link para redefinir a senha.');
      } else {
        setLocalError(result.error ?? 'Não foi possível enviar o link.');
      }
    } finally {
      setWorking(false);
    }
  };

  const message = localError ?? (status === 'sem-perfil' ? error : null);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-10">
      <main className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-2 text-center">
          <LogoLockup showSlogan />
        </div>

        <form
          className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-card"
          // A validação é a do próprio ALINHO, como no resto do aplicativo: a
          // nativa do navegador mostraria um balão fora do padrão visual.
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <div>
            <h1 className="text-lg font-semibold tracking-[-0.01em] text-ink">Entrar</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Use o e-mail cadastrado pela empresa. O acesso é individual e registra quem fez
              cada alteração.
            </p>
          </div>

          <TextInput
            label="E-mail"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
            data-autofocus
          />
          <TextInput
            label="Senha"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />

          {message ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md bg-critical-soft px-3 py-2 text-sm text-critical-ink"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {message}
            </p>
          ) : null}
          {notice ? (
            <p
              role="status"
              className="flex items-start gap-2 rounded-md bg-positive-soft px-3 py-2 text-sm text-positive-ink"
            >
              <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {notice}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={working}
            icon={<LogIn className="h-4 w-4" />}
          >
            Entrar
          </Button>

          <button
            type="button"
            onClick={handleReset}
            disabled={working}
            className="focus-ring self-center rounded-sm text-xs font-medium text-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
          >
            Esqueci minha senha
          </button>
        </form>

        <p className="mt-5 text-center text-xs leading-relaxed text-subtle">
          Não existe cadastro aberto: o administrador da empresa cria os acessos. Seus dados
          ficam no banco da empresa, com permissões por papel.
        </p>
      </main>
    </div>
  );
}
