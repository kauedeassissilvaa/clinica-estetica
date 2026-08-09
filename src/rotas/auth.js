const express = require('express');
const { pool } = require('../db');
const { hashSenha, conferirSenha, gerarToken, codigo6 } = require('../seguranca');

const rotas = express.Router();

// Modo demonstracao devolve o codigo de recuperacao na propria resposta.
// Em producao isso e um buraco de seguranca: deixe desligado e leia o codigo
// nos logs do Railway ate ligar um servico de e-mail de verdade.
const MODO_DEMO = process.env.MODO_DEMO === 'true';

// Trava simples contra forca bruta no login (memoria do processo).
const tentativas = new Map();
const LIMITE = 8;
const JANELA = 10 * 60 * 1000;

function bloqueado(chave) {
  const reg = tentativas.get(chave);
  if (!reg) return false;
  if (Date.now() - reg.desde > JANELA) { tentativas.delete(chave); return false; }
  return reg.contagem >= LIMITE;
}
function marcarFalha(chave) {
  const reg = tentativas.get(chave);
  if (!reg || Date.now() - reg.desde > JANELA) tentativas.set(chave, { contagem: 1, desde: Date.now() });
  else reg.contagem++;
}

const PROCEDIMENTOS_INICIAIS = [
  ['Limpeza de pele profunda', 'Facial', 180, 60],
  ['Peeling de diamante', 'Facial', 220, 45],
  ['Botox — terço superior', 'Injetável', 1200, 40],
  ['Preenchimento labial', 'Injetável', 1500, 50],
  ['Drenagem linfática', 'Corporal', 150, 60],
  ['Design de sobrancelha', 'Estética', 70, 30]
];

/* ---------------------------------------------------------- criar conta */
rotas.post('/registrar', async (req, res, next) => {
  try {
    const nome = String(req.body.nome || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const senha = String(req.body.senha || '');

    if (nome.length < 2) return res.status(400).json({ erro: 'Escreva seu nome.' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ erro: 'Esse e-mail não parece válido.' });
    if (senha.length < 6) return res.status(400).json({ erro: 'A senha precisa de pelo menos 6 caracteres.' });

    const [existe] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existe.length) return res.status(409).json({ erro: 'Esse e-mail já tem conta.' });

    const hash = await hashSenha(senha);
    const conexao = await pool.getConnection();
    try {
      await conexao.beginTransaction();
      const [r] = await conexao.query(
        'INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)',
        [nome, email, hash]
      );
      const usuarioId = r.insertId;

      // tabela de precos inicial, so pra clinica nao abrir vazia
      for (const p of PROCEDIMENTOS_INICIAIS) {
        await conexao.query(
          'INSERT INTO procedimentos (usuario_id, nome, categoria, preco, duracao) VALUES (?, ?, ?, ?, ?)',
          [usuarioId, p[0], p[1], p[2], p[3]]
        );
      }
      await conexao.commit();

      const usuario = { id: usuarioId, nome, email };
      res.status(201).json({ token: gerarToken(usuario), usuario });
    } catch (e) {
      await conexao.rollback();
      throw e;
    } finally {
      conexao.release();
    }
  } catch (e) { next(e); }
});

/* ---------------------------------------------------------------- login */
rotas.post('/entrar', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const senha = String(req.body.senha || '');
    const chave = req.ip + '|' + email;

    if (bloqueado(chave)) {
      return res.status(429).json({ erro: 'Muitas tentativas. Espere alguns minutos.' });
    }

    const [linhas] = await pool.query(
      'SELECT id, nome, email, senha_hash FROM usuarios WHERE email = ?', [email]
    );
    const u = linhas[0];

    // mesma mensagem para e-mail inexistente e senha errada,
    // pra nao entregar quais e-mails estao cadastrados
    if (!u || !(await conferirSenha(senha, u.senha_hash))) {
      marcarFalha(chave);
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }

    tentativas.delete(chave);
    const usuario = { id: u.id, nome: u.nome, email: u.email };
    res.json({ token: gerarToken(usuario), usuario });
  } catch (e) { next(e); }
});

/* ------------------------------------------------------- pedir o codigo */
rotas.post('/esqueci', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const [linhas] = await pool.query('SELECT id, nome FROM usuarios WHERE email = ?', [email]);

    // resposta identica exista ou nao a conta
    if (!linhas.length) return res.json({ enviado: true, demo: MODO_DEMO });

    const codigo = codigo6();
    await pool.query(
      'INSERT INTO recuperacoes (usuario_id, codigo, expira_em) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))',
      [linhas[0].id, codigo]
    );

    console.log(`[recuperacao] codigo ${codigo} para ${email} (vale 15 minutos)`);
    res.json({ enviado: true, demo: MODO_DEMO, codigo: MODO_DEMO ? codigo : undefined });
  } catch (e) { next(e); }
});

/* --------------------------------------------------------- trocar senha */
rotas.post('/redefinir', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const codigo = String(req.body.codigo || '').trim();
    const senha = String(req.body.senha || '');

    if (senha.length < 6) return res.status(400).json({ erro: 'A senha precisa de pelo menos 6 caracteres.' });

    const [linhas] = await pool.query(
      `SELECT r.id, r.usuario_id
         FROM recuperacoes r
         JOIN usuarios u ON u.id = r.usuario_id
        WHERE u.email = ? AND r.codigo = ? AND r.usado = 0 AND r.expira_em > NOW()
     ORDER BY r.id DESC LIMIT 1`,
      [email, codigo]
    );
    if (!linhas.length) return res.status(400).json({ erro: 'Código inválido ou vencido.' });

    const hash = await hashSenha(senha);
    await pool.query('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [hash, linhas[0].usuario_id]);
    await pool.query('UPDATE recuperacoes SET usado = 1 WHERE id = ?', [linhas[0].id]);

    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = rotas;
