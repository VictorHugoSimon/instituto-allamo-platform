/*
 * FCH-Horas-PMO.gs
 * Fonte normalizada de horas para o Portal PMO Államo.
 *
 * PRINCÍPIO DE SEGURANÇA
 * ----------------------
 * O FCH original é SOMENTE LEITURA. Este script nunca altera célula, fórmula,
 * aba, nome, formatação ou estrutura do arquivo de origem.
 *
 * Para arquivos XLSX, o script cria uma cópia técnica TEMPORÁRIA convertida
 * para Google Sheets, lê a cópia e a envia para a lixeira ao final. O XLSX
 * original permanece intocado.
 *
 * Configuração recomendada:
 * 1) Manter os FCH mensais em uma pasta do Google Drive.
 * 2) Definir FCH_FOLDER_ID nas Propriedades do Script.
 *    Alternativamente, para um único arquivo, definir FCH_FILE_ID.
 * 3) Para leitura automática de XLSX, habilitar o serviço avançado "Drive API"
 *    no projeto Apps Script. Arquivos Google Sheets nativos não precisam da conversão.
 * 4) Publicar este Apps Script como Web App.
 * 5) Configurar a URL /exec como HORAS_CSV_URL no Cloudflare.
 *
 * Regra de negócio OPR/Madri:
 * - qualquer lançamento cujo Projeto contenha OPR_Madri é replicado integralmente
 *   nas visões OPR e Madri;
 * - ex.: 4h em PMO_OPR_Madri => 4h OPR + 4h Madri;
 * - a replicação é por report. Não somar OPR + Madri como total global do Instituto.
 *
 * Prestadores considerados:
 * - Victor Hugo
 * - Gabriel
 *
 * O parser procura Data, Tempo da Atividade e Projeto PELO CABEÇALHO, e não
 * por letra fixa. Isso protege a integração porque os layouts das abas diferem.
 */

const FCH_FILE_PREFIX = 'FCH - Formulário de Controle de Horas_';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const GSHEET_MIME = MimeType.GOOGLE_SHEETS;

const FCH_PEOPLE = [
  {
    consultor: 'Victor Hugo',
    aliases: ['FCH - Victor Hugo', 'FCH- Victor Hugo', 'FCH -Victor Hugo', 'FCH Victor Hugo']
  },
  {
    consultor: 'Gabriel',
    aliases: ['FCH - Gabriel', 'FCH-Gabriel', 'FCH -Gabriel', 'FCH Gabriel']
  }
];

function norm_(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findHeader_(values) {
  for (let r = 0; r < Math.min(values.length, 20); r++) {
    const row = values[r].map(norm_);
    const projectIdx = row.findIndex(v => v === 'projeto');
    const timeIdx = row.findIndex(v => v.indexOf('tempo da atividade') >= 0);
    const dateIdx = row.findIndex(v => v === 'data dd mm aaaa' || v.indexOf('data') === 0);
    if (projectIdx >= 0 && timeIdx >= 0 && dateIdx >= 0) {
      return { row: r, projectIdx, timeIdx, dateIdx };
    }
  }
  return null;
}

function durationHours_(value) {
  if (value == null || value === '') return 0;

  if (value instanceof Date) {
    return value.getHours() + value.getMinutes() / 60 + value.getSeconds() / 3600;
  }

  if (typeof value === 'number') {
    if (!isFinite(value) || value <= 0) return 0;
    // Excel/Sheets normalmente guarda duração como fração do dia.
    return value <= 1.5 ? value * 24 : value;
  }

  const s = String(value).trim();
  const hm = s.match(/^(\d+):([0-5]\d)(?::([0-5]\d))?$/);
  if (hm) {
    return Number(hm[1]) + Number(hm[2]) / 60 + Number(hm[3] || 0) / 3600;
  }

  const n = Number(s.replace(/\s/g, '').replace(',', '.').replace(/[^0-9.-]/g, ''));
  if (!isFinite(n) || n <= 0) return 0;
  return n <= 1.5 ? n * 24 : n;
}

function monthKey_(value, fallbackName) {
  if (value instanceof Date && !isNaN(value)) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone() || 'America/Sao_Paulo',
      'yyyy-MM'
    );
  }

  const s = String(value || '').trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return br[3] + '-' + String(br[2]).padStart(2, '0');

  const iso = s.match(/^(\d{4})-(\d{2})/);
  if (iso) return iso[1] + '-' + iso[2];

  const months = {
    janeiro:'01', fevereiro:'02', marco:'03', abril:'04', maio:'05', junho:'06',
    julho:'07', agosto:'08', setembro:'09', outubro:'10', novembro:'11', dezembro:'12'
  };
  const nn = norm_(fallbackName);
  for (const k in months) {
    if (nn.indexOf(k) >= 0) {
      const yy = nn.match(/\b(20)?(\d{2})\b/);
      const year = yy
        ? (yy[1] ? yy[1] + yy[2] : '20' + yy[2])
        : String(new Date().getFullYear());
      return year + '-' + months[k];
    }
  }
  return '';
}

function mapProject_(project) {
  const p = norm_(project).replace(/\s+/g, '');
  if (!p) return [];

  // REGRA CENTRAL: OPR_Madri vale integralmente nas duas visões.
  if (p.indexOf('oprmadri') >= 0) {
    return [
      { empresa: 'OPR', projeto: 'OPR' },
      { empresa: 'Madri', projeto: 'Madri' }
    ];
  }

  if (p.indexOf('dualclima') >= 0) {
    return [{ empresa: 'Dual Clima', projeto: 'Dual Clima' }];
  }

  if (p.indexOf('madri') >= 0) {
    return [{ empresa: 'Madri', projeto: 'Madri' }];
  }

  if (p === 'opr' || p.indexOf('rfpopr') >= 0 || p.indexOf('pmoopr') >= 0) {
    return [{ empresa: 'OPR', projeto: 'OPR' }];
  }

  return [];
}

function findPersonSheet_(ss, aliases) {
  for (const name of aliases) {
    const sh = ss.getSheetByName(name);
    if (sh) return sh;
  }

  // Fallback tolerante a espaços/hífens diferentes.
  const targetNorms = aliases.map(norm_);
  for (const sh of ss.getSheets()) {
    const n = norm_(sh.getName());
    if (targetNorms.includes(n)) return sh;
  }
  return null;
}

function collectFromSpreadsheet_(ss, fileName) {
  const output = [];

  FCH_PEOPLE.forEach(person => {
    const sh = findPersonSheet_(ss, person.aliases);
    if (!sh) return;

    const values = sh.getDataRange().getValues();
    const h = findHeader_(values);
    if (!h) return;

    for (let r = h.row + 1; r < values.length; r++) {
      const row = values[r];
      const sourceProject = String(row[h.projectIdx] || '').trim();
      const hours = durationHours_(row[h.timeIdx]);
      if (!sourceProject || !hours || hours < 0) continue;

      const targets = mapProject_(sourceProject);
      if (!targets.length) continue;

      const mes = monthKey_(row[h.dateIdx], fileName);
      targets.forEach(t => output.push({
        empresa: t.empresa,
        projeto: t.projeto,
        hora: Math.round(hours * 10000) / 10000,
        mes: mes,
        consultor: person.consultor,
        projeto_origem: sourceProject,
        origem_compartilhada: /opr.*madri|madri.*opr/i.test(norm_(sourceProject).replace(/\s+/g, '')) ? 'sim' : 'nao'
      }));
    }
  });

  return output;
}

/**
 * Abre um FCH somente para leitura.
 * - Google Sheets: abre diretamente.
 * - XLSX: cria uma cópia técnica temporária convertida para Google Sheets.
 *
 * ATENÇÃO: nenhuma operação de escrita é executada no fileId de origem.
 */
function openReadOnlySpreadsheet_(file) {
  const mime = file.getMimeType();

  if (mime === GSHEET_MIME) {
    return {
      ss: SpreadsheetApp.openById(file.getId()),
      cleanup: function() {}
    };
  }

  if (mime !== XLSX_MIME) {
    throw new Error('Formato não suportado no FCH: ' + mime + ' (' + file.getName() + ')');
  }

  // XLSX: conversão em arquivo temporário. O arquivo original NÃO é alterado.
  if (typeof Drive === 'undefined' || !Drive.Files || !Drive.Files.create) {
    throw new Error(
      'Para ler XLSX automaticamente, habilite o serviço avançado Drive API no Apps Script. ' +
      'O FCH original continuará somente leitura.'
    );
  }

  const tempName = '__PMO_FCH_TEMP__' + Date.now() + '__' + file.getName();
  const metadata = {
    name: tempName,
    mimeType: 'application/vnd.google-apps.spreadsheet'
  };

  const converted = Drive.Files.create(metadata, file.getBlob(), { fields: 'id,name' });
  if (!converted || !converted.id) {
    throw new Error('Falha ao criar cópia técnica temporária do XLSX.');
  }

  const tempId = converted.id;
  return {
    ss: SpreadsheetApp.openById(tempId),
    cleanup: function() {
      try {
        // Remove SOMENTE a cópia técnica criada acima.
        DriveApp.getFileById(tempId).setTrashed(true);
      } catch (e) {
        console.warn('Não foi possível excluir a cópia temporária ' + tempId + ': ' + e);
      }
    }
  };
}

function sourceFiles_() {
  const props = PropertiesService.getScriptProperties();
  const fileId = props.getProperty('FCH_FILE_ID');
  if (fileId) return [DriveApp.getFileById(fileId)];

  const folderId = props.getProperty('FCH_FOLDER_ID');
  if (!folderId) {
    throw new Error('Defina FCH_FILE_ID (arquivo único) ou FCH_FOLDER_ID (pasta mensal).');
  }

  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  const out = [];
  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    if (name.indexOf(FCH_FILE_PREFIX) !== 0) continue;
    if (![GSHEET_MIME, XLSX_MIME].includes(file.getMimeType())) continue;
    out.push(file);
  }
  return out;
}

function collectAll_() {
  const rows = [];
  const files = sourceFiles_();

  files.forEach(file => {
    let opened = null;
    try {
      opened = openReadOnlySpreadsheet_(file);
      rows.push.apply(rows, collectFromSpreadsheet_(opened.ss, file.getName()));
    } finally {
      if (opened && opened.cleanup) opened.cleanup();
    }
  });

  return rows;
}

function csvEscape_(value) {
  const s = String(value == null ? '' : value);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCSV_(rows) {
  const headers = [
    'empresa',
    'projeto',
    'hora',
    'mes',
    'consultor',
    'projeto_origem',
    'origem_compartilhada'
  ];
  const lines = [headers.join(',')];
  rows.forEach(r => lines.push(headers.map(h => csvEscape_(r[h])).join(',')));
  return lines.join('\n');
}

function doGet(e) {
  try {
    const rows = collectAll_();

    // Diagnóstico opcional: ?format=json
    if (e && e.parameter && e.parameter.format === 'json') {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, rows: rows }, null, 2))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(toCSV_(rows))
      .setMimeType(ContentService.MimeType.CSV);
  } catch (e2) {
    const errorRow = [
      'empresa,projeto,hora,mes,consultor,projeto_origem,origem_compartilhada',
      'ERROR,ERROR,0,,,"' + String(e2).replace(/"/g, '""') + '",nao'
    ].join('\n');
    return ContentService.createTextOutput(errorRow).setMimeType(ContentService.MimeType.CSV);
  }
}

// Diagnóstico no editor do Apps Script.
function testFchHoras() {
  const rows = collectAll_();
  const agg = {};
  rows.forEach(r => {
    const k = r.empresa + '|' + r.mes;
    agg[k] = (agg[k] || 0) + Number(r.hora || 0);
  });
  Logger.log(JSON.stringify(agg, null, 2));
}

// Auditoria de segurança: retorna IDs/nome/mime das fontes sem alterar nada.
function testFontesSomenteLeitura() {
  const files = sourceFiles_();
  Logger.log(JSON.stringify(files.map(f => ({
    id: f.getId(),
    name: f.getName(),
    mime: f.getMimeType(),
    modified: f.getLastUpdated()
  })), null, 2));
}
