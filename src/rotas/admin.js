const express = require('express');
const { pool } = require('../db');
const { exigirAdmin } = require('../seguranca');

const rotas = express.Router();

// tudo aqui dentro so responde para quem e admin
rotas.use('/admin', exigirAdmin);

/* -------------------------------------------------- lista de acessos */
rotas.get('/admin/usuarios', async (req, res, next) => {
  try {
    const [linhas] = await pool.query(
      `SELECT u.id, u.nome, u.email, u.status, u.papel,
              DATE_FORMAT(u.criado_em, '%Y-%m-%d') AS criado_em,
              (SELECT COUNT(*) FROM pacientes p WHERE p.usuario_id = u.id) AS pacientes
         FROM usuarios u
     ORDER BY FIELD(u.status, 'pendente', 'aprovado', 'recusado'), u.id`
    );
    res.json(linhas.map(u => ({
      id: String(u.id), nome: u.nome, email: u.email,
      status: u.status, papel: u.papel,
      criadoEm: u.criado_em, pacientes: Number(u.pacientes),
      souEu: u.id === req.usuarioId
    })));
  } catch (e) { next(e); }
});

/* ------------------------------------------------ liberar ou recusar */
rotas.patch('/admin/usuarios/:id', async (req, res, next) => {
  try {
    const status = req.body.status;
    if (['pendente', 'aprovado', 'recusado'].indexOf(status) === -1) {
      return res.status(400).json({ erro: 'Situação inválida.' });
    }
    // trava de seguranca: o admin nao consegue se bloquear sozinho
    if (String(req.params.id) === String(req.usuarioId)) {
      return res.status(400).json({ erro: 'Você não pode alterar o próprio acesso.' });
    }

    const [r] = await pool.query(
      "UPDATE usuarios SET status = ? WHERE id = ? AND papel <> 'admin'",
      [status, req.params.id]
    );
    if (!r.affectedRows) return res.status(404).json({ erro: 'Conta não encontrada.' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ------------------------------------------------------- apagar conta */
rotas.delete('/admin/usuarios/:id', async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.usuarioId)) {
      return res.status(400).json({ erro: 'Você não pode apagar a própria conta.' });
    }
    // o ON DELETE CASCADE leva junto pacientes, atendimentos,
    // procedimentos, produtos e despesas daquela conta
    const [r] = await pool.query(
      "DELETE FROM usuarios WHERE id = ? AND papel <> 'admin'",
      [req.params.id]
    );
    if (!r.affectedRows) return res.status(404).json({ erro: 'Conta não encontrada.' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = rotas;
