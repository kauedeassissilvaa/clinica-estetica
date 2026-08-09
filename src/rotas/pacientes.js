const express = require('express');
const { pool } = require('../db');

const rotas = express.Router();

function texto(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
}
function numero(v) {
  const n = Number(v);
  return isFinite(n) && n >= 0 ? n : null;
}
function dataOuHoje(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : new Date().toISOString().slice(0, 10);
}

/* -------------------------------------------------------------- criar */
rotas.post('/pacientes', async (req, res, next) => {
  try {
    const nome = texto(req.body.nome, 160);
    if (nome.length < 2) return res.status(400).json({ erro: 'Escreva o nome do paciente.' });

    const [r] = await pool.query(
      'INSERT INTO pacientes (usuario_id, nome, telefone, obs) VALUES (?, ?, ?, ?)',
      [req.usuarioId, nome, texto(req.body.telefone, 40), texto(req.body.obs, 2000)]
    );
    res.status(201).json({ id: String(r.insertId) });
  } catch (e) { next(e); }
});

/* ------------------------------------------------------------- editar */
rotas.put('/pacientes/:id', async (req, res, next) => {
  try {
    const nome = texto(req.body.nome, 160);
    if (nome.length < 2) return res.status(400).json({ erro: 'Escreva o nome do paciente.' });

    // o usuario_id no WHERE e o que impede uma conta mexer na ficha de outra
    const [r] = await pool.query(
      'UPDATE pacientes SET nome = ?, telefone = ?, obs = ? WHERE id = ? AND usuario_id = ?',
      [nome, texto(req.body.telefone, 40), texto(req.body.obs, 2000), req.params.id, req.usuarioId]
    );
    if (!r.affectedRows) return res.status(404).json({ erro: 'Paciente não encontrado.' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ------------------------------------------------------------ excluir */
rotas.delete('/pacientes/:id', async (req, res, next) => {
  try {
    const [r] = await pool.query(
      'DELETE FROM pacientes WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuarioId]
    );
    if (!r.affectedRows) return res.status(404).json({ erro: 'Paciente não encontrado.' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ------------------------------------------------- lancar atendimento */
rotas.post('/pacientes/:id/atendimentos', async (req, res, next) => {
  try {
    const [dono] = await pool.query(
      'SELECT id FROM pacientes WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuarioId]
    );
    if (!dono.length) return res.status(404).json({ erro: 'Paciente não encontrado.' });

    const [proc] = await pool.query(
      'SELECT id, nome, preco FROM procedimentos WHERE id = ? AND usuario_id = ?',
      [req.body.procId, req.usuarioId]
    );
    if (!proc.length) return res.status(400).json({ erro: 'Escolha um procedimento válido.' });

    const valor = numero(req.body.valor);
    const [r] = await pool.query(
      `INSERT INTO atendimentos (usuario_id, paciente_id, procedimento_id, proc_nome, valor, data, pago)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.usuarioId, req.params.id, proc[0].id, proc[0].nome,
        valor === null ? Number(proc[0].preco) : valor,
        dataOuHoje(req.body.data),
        req.body.pago ? 1 : 0
      ]
    );
    res.status(201).json({ id: String(r.insertId) });
  } catch (e) { next(e); }
});

/* ------------------------------------------------- pago / nao pago */
rotas.patch('/atendimentos/:id', async (req, res, next) => {
  try {
    const [r] = await pool.query(
      'UPDATE atendimentos SET pago = ? WHERE id = ? AND usuario_id = ?',
      [req.body.pago ? 1 : 0, req.params.id, req.usuarioId]
    );
    if (!r.affectedRows) return res.status(404).json({ erro: 'Atendimento não encontrado.' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

rotas.delete('/atendimentos/:id', async (req, res, next) => {
  try {
    const [r] = await pool.query(
      'DELETE FROM atendimentos WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuarioId]
    );
    if (!r.affectedRows) return res.status(404).json({ erro: 'Atendimento não encontrado.' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = rotas;
module.exports.util = { texto, numero, dataOuHoje };
