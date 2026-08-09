const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const SEGREDO = process.env.JWT_SEGREDO || crypto.randomBytes(32).toString('hex');

if (!process.env.JWT_SEGREDO) {
  console.warn(
    '[seguranca] JWT_SEGREDO nao definido. Um segredo aleatorio foi gerado, ' +
    'entao todo mundo cai fora do sistema a cada deploy. Defina a variavel no Railway.'
  );
}

async function hashSenha(senha) {
  return bcrypt.hash(senha, 10);
}

async function conferirSenha(senha, hash) {
  return bcrypt.compare(senha, hash);
}

function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, nome: usuario.nome, email: usuario.email },
    SEGREDO,
    { expiresIn: '7d' }
  );
}

// Toda rota de dados passa por aqui. Se o token nao valer, nem chega no banco.
function exigirLogin(req, res, next) {
  const cabecalho = req.headers.authorization || '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : null;

  if (!token) return res.status(401).json({ erro: 'Faca login para continuar.' });

  try {
    const dados = jwt.verify(token, SEGREDO);
    req.usuarioId = dados.id;
    req.usuario = dados;
    next();
  } catch (e) {
    return res.status(401).json({ erro: 'Sessao expirada. Entre de novo.' });
  }
}

function codigo6() {
  return String(crypto.randomInt(100000, 1000000));
}

module.exports = { hashSenha, conferirSenha, gerarToken, exigirLogin, codigo6 };
