const express = require('express');
const { pool } = require('../db');
const { texto, numero } = require('./pacientes').util;

const rotas = express.Router();

rotas.post('/procedimentos', async (req, res, next) => {
  try {
    const nome = texto(req.body.nome, 160);
    const preco = numero(req.body.preco);
    if (nome.length < 2) return res.status(400).json({ erro: 'Escreva o nome do procedimento.' });
    if (preco === null) return res.status(400).json({ erro: 'Informe o preço.' });

    const [r] = await pool.query(
      'INSERT INTO procedimentos (usuario_id, nome, categoria, preco, duracao) VALUES (?, ?, ?, ?, ?)',
      [req.usuarioId, nome, texto(req.body.categoria, 60) || 'Geral', preco, numero(req.body.duracao) || 0]
    );
    res.status(201).json({ id: String(r.insertId) });
  } catch (e) { next(e); }
});

rotas.put('/procedimentos/:id', async (req, res, next) => {
  try {
    const nome = texto(req.body.nome, 160);
    const preco = numero(req.body.preco);
    if (nome.length < 2) return res.status(400).json({ erro: 'Escreva o nome do procedimento.' });
    if (preco === null) return res.status(400).json({ erro: 'Informe o preço.' });

    const conexao = await pool.getConnection();
    try {
      await conexao.beginTransaction();
      const [r] = await conexao.query(
        'UPDATE procedimentos SET nome = ?, categoria = ?, preco = ?, duracao = ? WHERE id = ? AND usuario_id = ?',
        [nome, texto(req.body.categoria, 60) || 'Geral', preco, numero(req.body.duracao) || 0,
         req.params.id, req.usuarioId]
      );
      if (!r.affectedRows) {
        await conexao.rollback();
        return res.status(404).json({ erro: 'Procedimento não encontrado.' });
      }
      // mantem o nome coerente nas fichas antigas
      await conexao.query(
        'UPDATE atendimentos SET proc_nome = ? WHERE procedimento_id = ? AND usuario_id = ?',
        [nome, req.params.id, req.usuarioId]
      );
      await conexao.commit();
      res.json({ ok: true });
    } catch (e) {
      await conexao.rollback();
      throw e;
    } finally {
      conexao.release();
    }
  } catch (e) { next(e); }
});

rotas.delete('/procedimentos/:id', async (req, res, next) => {
  try {
    // os atendimentos antigos continuam: o procedimento_id vira NULL
    // e o proc_nome que ja esta gravado segura o historico
    const [r] = await pool.query(
      'DELETE FROM procedimentos WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuarioId]
    );
    if (!r.affectedRows) return res.status(404).json({ erro: 'Procedimento não encontrado.' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = rotas;
