# Lumina — sistema da clínica estética

Node + Express + MySQL, pronto para o Railway. Cada conta criada é uma clínica independente: os pacientes, procedimentos, estoque e despesas de uma conta não aparecem para nenhuma outra.

**Acesso é por aprovação.** A primeira conta criada vira administradora. Da segunda em diante, quem se cadastra fica esperando na aba **Acessos** até o administrador liberar.

---

## O que tem dentro

```
clinica-api/
├── server.js              sobe o Express, monta as rotas, serve o site
├── package.json
├── .env.example           modelo das variáveis (o .env real não vai pro git)
├── .gitignore
├── src/
│   ├── db.js              conexão MySQL + criação automática das tabelas
│   ├── seguranca.js       JWT, hash de senha, middleware de login
│   └── rotas/
│       ├── auth.js        registrar, entrar, esqueci, redefinir
│       ├── dados.js       GET /api/dados — carrega a clínica inteira
│       ├── pacientes.js   pacientes e atendimentos
│       ├── procedimentos.js
│       ├── produtos.js    estoque + movimentação
│       └── despesas.js
└── public/
    └── index.html         o sistema inteiro (front)
```

As tabelas são criadas sozinhas no primeiro start (`CREATE TABLE IF NOT EXISTS`). Você não precisa rodar migration na mão.

---

## Passo a passo do deploy

### 1. Subir o código para o GitHub

Abra o PowerShell dentro da pasta `clinica-api`.

```powershell
git init
```
Cria o repositório local — uma pasta escondida `.git` que passa a guardar o histórico. Roda só uma vez, no começo.

```powershell
git add .
```
Coloca os arquivos na "área de preparação" (staging). É você dizendo: *estes arquivos entram no próximo commit*. O ponto significa "tudo desta pasta", e o `.gitignore` garante que `node_modules` e `.env` fiquem de fora.

```powershell
git commit -m "sistema da clinica estetica com backend"
```
Grava de fato o pacote de alterações no histórico, com uma mensagem descrevendo o que mudou. O commit é local: ainda não saiu da sua máquina.

```powershell
git branch -M main
```
Renomeia a branch atual para `main`. O git antigo criava `master`; GitHub e Railway esperam `main`, então isso evita confusão depois.

```powershell
git remote add origin https://github.com/wknzz/clinica-estetica.git
```
Cadastra o endereço do repositório remoto com o apelido `origin`. Crie o repositório vazio no GitHub antes (sem README, sem .gitignore — senão dá conflito no primeiro push).

```powershell
git push -u origin main
```
Envia os commits para o GitHub. O `-u` amarra sua branch local à do servidor, então dos próximos pushes em diante basta `git push`.

**Dos próximos deploys em diante o ciclo é só isto:**
```powershell
git add .
git commit -m "descricao do que mudou"
git push
```

### 2. Criar o projeto no Railway

1. railway.app → **New Project** → **Deploy from GitHub repo** → escolha `clinica-estetica`.
2. O Railway detecta Node, roda `npm install` e `npm start` sozinho.
3. O primeiro deploy vai **falhar** — é esperado, ainda não existe banco.

### 3. Adicionar o MySQL

No mesmo projeto: **New** → **Database** → **Add MySQL**.

Agora o pulo do gato: vá no serviço da aplicação → aba **Variables** → **Add Variable Reference** → escolha o MySQL → variável `MYSQL_URL`. Isso liga a aplicação ao banco. O `src/db.js` já procura por `MYSQL_URL` primeiro.

### 4. As outras variáveis

Ainda em **Variables**, adicione:

| Variável | Valor | Para quê |
|---|---|---|
| `JWT_SEGREDO` | uma frase longa e aleatória sua | assina os tokens de login |
| `MODO_DEMO` | `false` | ver seção de recuperação de senha abaixo |

`PORT` o Railway define sozinho — não mexa.

Sobre o `JWT_SEGREDO`: se ele não existir, o sistema gera um aleatório a cada boot e **todo mundo é deslogado a cada deploy**. Se você trocar o valor depois, mesma coisa. Defina uma vez e deixe quieto.

### 5. Gerar o domínio

Serviço da aplicação → **Settings** → **Networking** → **Generate Domain**. Sai algo como `clinica-estetica-production.up.railway.app`.

Abra, clique em **Criar uma conta**, e pronto: a clínica já nasce com uma tabela de preços inicial de 6 procedimentos (é só editar ou apagar).

---

## Recuperação de senha — leia antes de liberar para outras pessoas

Não existe servidor de e-mail aqui. O código de 6 dígitos é gerado, salvo no banco com validade de 15 minutos e **impresso no log do servidor**.

- `MODO_DEMO=true` → o código volta na resposta da API e aparece na tela. Prático para testar, **mas qualquer um consegue resetar a senha de qualquer conta**. Nunca deixe assim com dados reais de pacientes.
- `MODO_DEMO=false` (recomendado) → o código só aparece nos **Deploy Logs** do Railway. Você lê lá e passa para a pessoa.

Quando quiser resolver de verdade, o caminho é plugar um serviço de e-mail (Resend, SendGrid, Brevo) dentro de `src/rotas/auth.js`, na rota `/esqueci`, onde hoje tem o `console.log`.

---

## Rodar na sua máquina

Precisa de um MySQL local. Se preferir, use o próprio banco do Railway: na aba do MySQL, copie a variável `MYSQL_PUBLIC_URL` e cole no `.env` como `MYSQL_URL`.

```powershell
npm install
copy .env.example .env
npm start
```

Abra `http://localhost:3000`.

---

## Detalhes que valem saber

**Controle de acesso.** Cadastrar não dá acesso: a conta nasce com status `pendente` e o login é recusado até o administrador liberar na aba **Acessos**. O status é relido do banco a cada requisição, então recusar alguém derruba o acesso na hora, mesmo que a pessoa já esteja logada com token válido. O administrador não consegue bloquear nem apagar a própria conta, e ninguém consegue mexer numa conta admin.

**Isolamento entre contas.** Toda query tem `usuario_id = ?` no `WHERE`, inclusive nos `UPDATE` e `DELETE`. Se alguém adivinhar o id de um paciente de outra conta e tentar apagar, a resposta é "não encontrado" e nada acontece. Isso foi testado.

**Movimentação de estoque é transacional.** Entrada, baixa e a despesa gerada pela compra acontecem numa transação com `SELECT ... FOR UPDATE`. Se duas pessoas derem baixa no mesmo produto ao mesmo tempo, uma espera a outra — não dá para o saldo ficar negativo.

**Editar procedimento renomeia nas fichas antigas.** O `UPDATE` do nome roda junto com um `UPDATE` nos atendimentos, na mesma transação.

**Excluir procedimento não apaga histórico.** O `procedimento_id` do atendimento vira `NULL`, mas o `proc_nome` já está gravado na linha — a ficha antiga continua legível.

**Senhas.** Guardadas com bcrypt (custo 10). O banco nunca vê a senha em texto puro.

**Força bruta.** 8 tentativas erradas de login por IP + e-mail em 10 minutos e trava. O contador vive na memória do processo, então zera a cada deploy — suficiente para o tamanho disso, mas não é uma proteção séria contra ataque distribuído.

**Receita no gráfico é por competência**, não por caixa: conta todo atendimento do mês, pago ou não. O caixa de verdade está na barra de recebimento, que separa recebido de a receber.

---

## Rotas da API

| Método | Rota | O que faz |
|---|---|---|
| POST | `/api/auth/registrar` | cria conta + clínica |
| POST | `/api/auth/entrar` | login, devolve token |
| POST | `/api/auth/esqueci` | gera código de recuperação |
| POST | `/api/auth/redefinir` | troca a senha com o código |
| GET | `/api/admin/usuarios` | lista de acessos (só admin) |
| PATCH | `/api/admin/usuarios/:id` | liberar / recusar (só admin) |
| DELETE | `/api/admin/usuarios/:id` | apagar conta e dados (só admin) |
| GET | `/api/dados` | carrega a clínica inteira |
| GET | `/api/saude` | checar se o deploy subiu |
| POST/PUT/DELETE | `/api/pacientes[/:id]` | fichas |
| POST | `/api/pacientes/:id/atendimentos` | lançar procedimento |
| PATCH/DELETE | `/api/atendimentos/:id` | pago/não pago, remover |
| POST/PUT/DELETE | `/api/procedimentos[/:id]` | tabela de preços |
| POST/PUT/DELETE | `/api/produtos[/:id]` | estoque |
| POST | `/api/produtos/:id/movimento` | entrada / baixa |
| POST/PUT/PATCH/DELETE | `/api/despesas[/:id]` | despesas |

Menos `/api/auth/*` e `/api/saude`, todas exigem o cabeçalho `Authorization: Bearer <token>`.
