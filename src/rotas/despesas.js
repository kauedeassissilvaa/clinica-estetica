const express = require('express');
const { pool } = require('../db');
const { texto, numero, dataOuHoje } = require('./pacientes').util;

const rotas = express.Router();

rotas.post('/despesas', async (req, res, next) => {
  try {
    const descricao = texto(req.body.descricao, 200);
    const valor = numero(req.body.valor);
    if (descricao.length < 2) return res.status(400).json({ erro: 'Escreva a descrição da despesa.' });
    if (valor === null) return res.status(400).json({ erro: 'Informe o valor.' });

    const [r] = await pool.query(
      'INSERT INTO despesas (usuario_id, descricao, categoria, valor, data, pago) VALUES (?, ?, ?, ?, ?, ?)',
      [req.usuarioId, descricao, texto(req.body.categoria, 60) || 'Outros', valor,
       dataOuHoje(req.body.data), req.body.pago ? 1 : 0]
    );
    res.status(201).json({ id: String(r.insertId) });
  } catch (e) { next(e); }
});

rotas.put('/despesas/:id', async (req, res, next) => {
  try {
    const descricao = texto(req.body.descricao, 200);
    const valor = numero(req.body.valor);
    if (descricao.length < 2) return res.status(400).json({ erro: 'Escreva a descrição da despesa.' });
    if (valor === null) return res.status(400).json({ erro: 'Informe o valor.' });

    const [r] = await pool.query(
      `UPDATE despesas SET descricao = ?, categoria = ?, valor = ?, data = ?, pago = ?
        WHERE id = ? AND usuario_id = ?`,
      [descricao, texto(req.body.categoria, 60) || 'Outros', valor, dataOuHoje(req.body.data),
       req.body.pago ? 1 : 0, req.params.id, req.usuarioId]
    );
    if (!r.affectedRows) return res.status(404).json({ erro: 'Despesa não encontrada.' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

rotas.patch('/despesas/:id', async (req, res, next) => {
  try {
    const [r] = await pool.query(
      'UPDATE despesas SET pago = ? WHERE id = ? AND usuario_id = ?',
      [req.body.pago ? 1 : 0, req.params.id, req.usuarioId]
    );
    if (!r.affectedRows) return res.status(404).json({ erro: 'Despesa não encontrada.' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

rotas.delete('/despesas/:id', async (req, res, next) => {
  try {
    const [r] = await pool.query(
      'DELETE FROM despesas WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuarioId]
    );
    if (!r.affectedRows) return res.status(404).json({ erro: 'Despesa não encontrada.' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = rotas;
