const mysql = require('mysql2/promise');

/*
  O Railway injeta as variáveis do MySQL automaticamente quando você
  liga o banco ao serviço. Ele expõe tanto uma URL única (MYSQL_URL)
  quanto as variáveis separadas. Aceitamos as duas formas, e caímos
  para localhost quando você roda na sua máquina.
*/
function opcoes() {
  const url =
    process.env.MYSQL_URL ||
    process.env.DATABASE_URL ||
    process.env.MYSQL_PUBLIC_URL;

  const comuns = {
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: true
  };

  if (url) return Object.assign({ uri: url }, comuns);

  return Object.assign({
    host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'lumina'
  }, comuns);
}

const pool = mysql.createPool(opcoes());

const TABELAS = [
  `CREATE TABLE IF NOT EXISTS usuarios (
     id INT AUTO_INCREMENT PRIMARY KEY,
     nome VARCHAR(120) NOT NULL,
     email VARCHAR(160) NOT NULL UNIQUE,
     senha_hash VARCHAR(255) NOT NULL,
     criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS recuperacoes (
     id INT AUTO_INCREMENT PRIMARY KEY,
     usuario_id INT NOT NULL,
     codigo CHAR(6) NOT NULL,
     expira_em DATETIME NOT NULL,
     usado TINYINT(1) NOT NULL DEFAULT 0,
     INDEX idx_rec_usuario (usuario_id),
     FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS procedimentos (
     id INT AUTO_INCREMENT PRIMARY KEY,
     usuario_id INT NOT NULL,
     nome VARCHAR(160) NOT NULL,
     categoria VARCHAR(60) NOT NULL DEFAULT 'Geral',
     preco DECIMAL(10,2) NOT NULL DEFAULT 0,
     duracao INT NOT NULL DEFAULT 0,
     INDEX idx_proc_usuario (usuario_id),
     FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS pacientes (
     id INT AUTO_INCREMENT PRIMARY KEY,
     usuario_id INT NOT NULL,
     nome VARCHAR(160) NOT NULL,
     telefone VARCHAR(40) NULL,
     obs TEXT NULL,
     criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     INDEX idx_pac_usuario (usuario_id),
     FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS atendimentos (
     id INT AUTO_INCREMENT PRIMARY KEY,
     usuario_id INT NOT NULL,
     paciente_id INT NOT NULL,
     procedimento_id INT NULL,
     proc_nome VARCHAR(160) NOT NULL,
     valor DECIMAL(10,2) NOT NULL DEFAULT 0,
     data DATE NOT NULL,
     pago TINYINT(1) NOT NULL DEFAULT 0,
     INDEX idx_at_usuario (usuario_id),
     INDEX idx_at_paciente (paciente_id),
     INDEX idx_at_data (usuario_id, data),
     FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
     FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
     FOREIGN KEY (procedimento_id) REFERENCES procedimentos(id) ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS produtos (
     id INT AUTO_INCREMENT PRIMARY KEY,
     usuario_id INT NOT NULL,
     nome VARCHAR(160) NOT NULL,
     categoria VARCHAR(60) NOT NULL DEFAULT 'Geral',
     unidade VARCHAR(20) NOT NULL DEFAULT 'un',
     quantidade INT NOT NULL DEFAULT 0,
     minimo INT NOT NULL DEFAULT 0,
     custo DECIMAL(10,2) NOT NULL DEFAULT 0,
     INDEX idx_prod_usuario (usuario_id),
     FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS despesas (
     id INT AUTO_INCREMENT PRIMARY KEY,
     usuario_id INT NOT NULL,
     descricao VARCHAR(200) NOT NULL,
     categoria VARCHAR(60) NOT NULL DEFAULT 'Outros',
     valor DECIMAL(10,2) NOT NULL DEFAULT 0,
     data DATE NOT NULL,
     pago TINYINT(1) NOT NULL DEFAULT 0,
     INDEX idx_desp_usuario (usuario_id),
     INDEX idx_desp_data (usuario_id, data),
     FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];

async function criarTabelas() {
  for (const sql of TABELAS) {
    await pool.query(sql);
  }
  console.log('[db] tabelas conferidas');
}

module.exports = { pool, criarTabelas };
