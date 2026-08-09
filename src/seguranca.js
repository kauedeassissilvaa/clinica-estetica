const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('./db');

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
    { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel || 'usuario' },
    SEGREDO,
    { expiresIn: '7d' }
  );
}

/*
  Toda rota de dados passa por aqui. Alem de conferir o token, relemos o
  status no banco a cada requisicao: assim, quando o administrador recusa
  alguem, o acesso cai na hora, sem esperar o token vencer.
*/
async function exigirLogin(req, res, next) {
  const cabecalho = req.headers.authorization || '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : null;

  if (!token) return res.status(401).json({ erro: 'Faca login para continuar.' });

  let dados;
  try {
    dados = jwt.verify(token, SEGREDO);
  } catch (e) {
    return res.status(401).json({ erro: 'Sessao expirada. Entre de novo.' });
  }

  try {
    const [linhas] = await pool.query(
      'SELECT id, nome, email, status, papel FROM usuarios WHERE id = ?', [dados.id]
    );
    const u = linhas[0];
    if (!u) return res.status(401).json({ erro: 'Conta nao encontrada.' });
    if (u.status !== 'aprovado') {
      return res.status(403).json({ erro: 'Seu acesso ainda nao foi liberado.' });
    }
    req.usuarioId = u.id;
    req.usuario = u;
    next();
  } catch (e) {
    next(e);
  }
}

// so o administrador mexe na lista de acessos
function exigirAdmin(req, res, next) {
  if (!req.usuario || req.usuario.papel !== 'admin') {
    return res.status(403).json({ erro: 'Só o administrador pode fazer isso.' });
  }
  next();
}

function codigo6() {
  return String(crypto.randomInt(100000, 1000000));
}

module.exports = { hashSenha, conferirSenha, gerarToken, exigirLogin, exigirAdmin, codigo6 };
