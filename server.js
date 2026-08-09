require('dotenv').config();

const path = require('path');
const express = require('express');
const { criarTabelas } = require('./src/db');
const { exigirLogin } = require('./src/seguranca');

const app = express();
const PORTA = process.env.PORT || 3000;

app.set('trust proxy', 1); // o Railway fica atras de proxy; sem isso o req.ip vem errado
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// saude do servico — util pra checar se o deploy subiu
app.get('/api/saude', (req, res) => res.json({ ok: true, hora: new Date().toISOString() }));

// login e cadastro sao publicos
app.use('/api/auth', require('./src/rotas/auth'));

// daqui pra baixo tudo exige token
app.use('/api', exigirLogin, require('./src/rotas/dados'));
app.use('/api', exigirLogin, require('./src/rotas/pacientes'));
app.use('/api', exigirLogin, require('./src/rotas/procedimentos'));
app.use('/api', exigirLogin, require('./src/rotas/produtos'));
app.use('/api', exigirLogin, require('./src/rotas/despesas'));

app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

// qualquer outro caminho devolve a tela do sistema
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// erro inesperado: loga completo no servidor, devolve mensagem curta pro navegador
app.use((erro, req, res, proximo) => {
  console.error('[erro]', erro);
  res.status(500).json({ erro: 'Algo quebrou aqui do lado. Tente de novo.' });
});

criarTabelas()
  .then(() => {
    app.listen(PORTA, () => console.log(`[servidor] no ar na porta ${PORTA}`));
  })
  .catch((erro) => {
    console.error('[servidor] nao consegui preparar o banco:', erro.message);
    process.exit(1);
  });
