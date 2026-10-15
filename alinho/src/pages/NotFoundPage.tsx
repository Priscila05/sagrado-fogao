import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState, Panel } from '../components/ui/primitives';
import { Button } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <Panel>
      <EmptyState
        icon={Compass}
        title="Página não encontrada"
        description="O endereço acessado não existe no ALINHO."
        action={
          <Link to="/" className="focus-ring rounded-md">
            <Button variant="primary">Ir para a visão geral</Button>
          </Link>
        }
      />
    </Panel>
  );
}
