const express = require('express');
const { pool } = require('../db');

const rotas = express.Router();

/*
  O front carrega tudo numa chamada so e desenha as telas em cima disso.
  E pouco dado (uma clinica pequena), entao vale mais a simplicidade do que
  paginar cada tela separadamente.
*/
rotas.get('/dados', async (req, res, next) => {
  try {
    const uid = req.usuarioId;

    const [procedimentos] = await pool.query(
      'SELECT id, nome, categoria, preco, duracao FROM procedimentos WHERE usuario_id = ? ORDER BY categoria, nome',
      [uid]
    );
    const [pacientes] = await pool.query(
      'SELECT id, nome, telefone, obs FROM pacientes WHERE usuario_id = ? ORDER BY nome',
      [uid]
    );
    const [atendimentos] = await pool.query(
      `SELECT id, paciente_id, procedimento_id, proc_nome, valor,
              DATE_FORMAT(data, '%Y-%m-%d') AS data, pago
         FROM atendimentos WHERE usuario_id = ? ORDER BY data DESC, id DESC`,
      [uid]
    );
    const [produtos] = await pool.query(
      'SELECT id, nome, categoria, unidade, quantidade, minimo, custo FROM produtos WHERE usuario_id = ? ORDER BY nome',
      [uid]
    );
    const [despesas] = await pool.query(
      `SELECT id, descricao, categoria, valor,
              DATE_FORMAT(data, '%Y-%m-%d') AS data, pago
         FROM despesas WHERE usuario_id = ? ORDER BY data DESC, id DESC`,
      [uid]
    );

    // o front trabalha com os atendimentos aninhados dentro do paciente
    const porPaciente = new Map();
    pacientes.forEach(p => {
      p.id = String(p.id);
      p.obs = p.obs || '';
      p.telefone = p.telefone || '';
      p.atendimentos = [];
      porPaciente.set(p.id, p);
    });
    atendimentos.forEach(a => {
      const dono = porPaciente.get(String(a.paciente_id));
      if (!dono) return;
      dono.atendimentos.push({
        id: String(a.id),
        procId: a.procedimento_id === null ? null : String(a.procedimento_id),
        procNome: a.proc_nome,
        valor: Number(a.valor),
        data: a.data,
        pago: !!a.pago
      });
    });

    res.json({
      procedimentos: procedimentos.map(p => ({
        id: String(p.id), nome: p.nome, categoria: p.categoria,
        preco: Number(p.preco), duracao: Number(p.duracao)
      })),
      pacientes,
      produtos: produtos.map(p => ({
        id: String(p.id), nome: p.nome, categoria: p.categoria, unidade: p.unidade,
        quantidade: Number(p.quantidade), minimo: Number(p.minimo), custo: Number(p.custo)
      })),
      despesas: despesas.map(d => ({
        id: String(d.id), descricao: d.descricao, categoria: d.categoria,
        valor: Number(d.valor), data: d.data, pago: !!d.pago
      }))
    });
  } catch (e) { next(e); }
});

module.exports = rotas;
