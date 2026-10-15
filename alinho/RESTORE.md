# Ponto de restauração

Antes de qualquer alteração da versão multiusuário, o estado do projeto foi congelado no
commit abaixo. Ele continua publicado na branch do repositório — nada foi reescrito.

| | |
| --- | --- |
| **Commit** | `15c202043f39c34dcd00a18c542d7594dc838548` |
| **Branch** | `claude/gallant-goodall-ri6ssr` |
| **Mensagem** | "Acrescenta o módulo de controle financeiro ao ALINHO" |
| **O que é** | ALINHO monousuário completo: CRM + módulo financeiro, 100% local (IndexedDB), sem login, build e ZIP prontos para o Netlify. |

> Também existe a tag local `v1.1-local-financeiro` apontando para esse commit. O proxy de
> rede desta sessão recusa o envio de tags, então a referência durável é o próprio commit
> acima, que já está no repositório remoto.

## Como voltar ao estado anterior

**Ver ou baixar aquela versão, sem mexer no que existe hoje:**

```bash
git fetch origin
git checkout 15c202043f39c34dcd00a18c542d7594dc838548 -- alinho/
```

**Publicar de novo a versão monousuário no Netlify** (ela não depende de Supabase):

```bash
git checkout 15c202043f39c34dcd00a18c542d7594dc838548
cd alinho && npm install && npm run build && npm run package
# suba dist-zip/alinho-netlify.zip em app.netlify.com/drop
```

**Desfazer a versão multiusuário mantendo o histórico:**

```bash
git revert --no-commit 15c202043f39c34dcd00a18c542d7594dc838548..HEAD
git commit -m "Reverte a versão multiusuário"
```

## Segurança dos dados

- A versão multiusuário **não apaga nem migra** automaticamente os dados do navegador: o
  banco local (IndexedDB `alinho`) continua intacto e é usado sempre que o Supabase não
  estiver configurado.
- O envio dos dados locais para o Supabase só acontece por ação explícita em
  *Configurações → Enviar dados para o Supabase*, e exige confirmação.
- Nenhuma migração remota foi executada: os arquivos em `supabase/migrations/` precisam ser
  rodados por você no painel do Supabase.
