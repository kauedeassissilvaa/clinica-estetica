const express = require('express');
const { pool } = require('../db');
const { texto, numero, dataOuHoje } = require('./pacientes').util;

const rotas = express.Router();

rotas.post('/produtos', async (req, res, next) => {
  try {
    const nome = texto(req.body.nome, 160);
    const custo = numero(req.body.custo);
    if (nome.length < 2) return res.status(400).json({ erro: 'Escreva o nome do produto.' });
    if (custo === null) return res.status(400).json({ erro: 'Informe o custo por unidade.' });

    const [r] = await pool.query(
      `INSERT INTO produtos (usuario_id, nome, categoria, unidade, quantidade, minimo, custo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.usuarioId, nome, texto(req.body.categoria, 60) || 'Geral', texto(req.body.unidade, 20) || 'un',
       numero(req.body.quantidade) || 0, numero(req.body.minimo) || 0, custo]
    );
    res.status(201).json({ id: String(r.insertId) });
  } catch (e) { next(e); }
});

rotas.put('/produtos/:id', async (req, res, next) => {
  try {
    const nome = texto(req.body.nome, 160);
    const custo = numero(req.body.custo);
    if (nome.length < 2) return res.status(400).json({ erro: 'Escreva o nome do produto.' });
    if (custo === null) return res.status(400).json({ erro: 'Informe o custo por unidade.' });

    const [r] = await pool.query(
      `UPDATE produtos SET nome = ?, categoria = ?, unidade = ?, quantidade = ?, minimo = ?, custo = ?
        WHERE id = ? AND usuario_id = ?`,
      [nome, texto(req.body.categoria, 60) || 'Geral', texto(req.body.unidade, 20) || 'un',
       numero(req.body.quantidade) || 0, numero(req.body.minimo) || 0, custo,
       req.params.id, req.usuarioId]
    );
    if (!r.affectedRows) return res.status(404).json({ erro: 'Produto não encontrado.' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

rotas.delete('/produtos/:id', async (req, res, next) => {
  try {
    const [r] = await pool.query(
      'DELETE FROM produtos WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuarioId]
    );
    if (!r.affectedRows) return res.status(404).json({ erro: 'Produto não encontrado.' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/*
  Entrada e baixa vao numa transacao junto com a despesa: se der erro
  no meio, nada e gravado. Isso evita o classico "o estoque subiu mas a
  despesa nao entrou".
*/
rotas.post('/produtos/:id/movimento', async (req, res, next) => {
  const conexao = await pool.getConnection();
  try {
    const tipo = req.body.tipo === 'entrada' ? 'entrada' : 'baixa';
    const qtd = numero(req.body.quantidade);
    if (qtd === null || qtd < 1) {
      conexao.release();
      return res.status(400).json({ erro: 'Informe uma quantidade válida.' });
    }

    await conexao.beginTransaction();

    // FOR UPDATE trava a linha ate o commit: se duas pessoas derem baixa
    // no mesmo produto ao mesmo tempo, uma espera a outra
    const [linhas] = await conexao.query(
      'SELECT id, nome, quantidade, custo FROM produtos WHERE id = ? AND usuario_id = ? FOR UPDATE',
      [req.params.id, req.usuarioId]
    );
    if (!linhas.length) {
      await conexao.rollback();
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }
    const produto = linhas[0];

    if (tipo === 'baixa') {
      if (qtd > produto.quantidade) {
        await conexao.rollback();
        return res.status(400).json({ erro: 'Só tem ' + produto.quantidade + ' em estoque.' });
      }
      await conexao.query('UPDATE produtos SET quantidade = quantidade - ? WHERE id = ?', [qtd, produto.id]);
    } else {
      const custo = numero(req.body.custo);
      if (custo === null) {
        await conexao.rollback();
        return res.status(400).json({ erro: 'Informe o custo unitário.' });
      }
      await conexao.query(
        'UPDATE produtos SET quantidade = quantidade + ?, custo = ? WHERE id = ?',
        [qtd, custo, produto.id]
      );
      if (req.body.gerarDespesa) {
        await conexao.query(
          'INSERT INTO despesas (usuario_id, descricao, categoria, valor, data, pago) VALUES (?, ?, ?, ?, ?, 0)',
          [req.usuarioId, 'Compra — ' + produto.nome, 'Produtos', qtd * custo, dataOuHoje(req.body.data)]
        );
      }
    }

    await conexao.commit();
    res.json({ ok: true });
  } catch (e) {
    try { await conexao.rollback(); } catch (x) {}
    next(e);
  } finally {
    conexao.release();
  }
});

module.exports = rotas;
