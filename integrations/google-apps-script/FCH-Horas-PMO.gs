/*
 * FCH-Horas-PMO.gs
 * Fonte normalizada de horas para o Portal PMO Államo.
 *
 * Uso recomendado:
 * 1) Manter os FCH mensais como Google Sheets dentro de uma pasta do Drive.
 * 2) Definir a propriedade de script FCH_FOLDER_ID com o ID da pasta.
 * 3) Publicar este Apps Script como Web App (Executar como: proprietário; acesso: conforme política interna).
 * 4) Configurar a URL /exec como HORAS_CSV_URL no Cloudflare Pages/Worker.
 *
 * Regra de negócio OPR/Madri:
 * - lançamento em projeto que contenha OPR_Madri é replicado integralmente nas visões OPR e Madri;
 * - essa replicação é apenas para visão por projeto/cliente. Não usar a soma OPR+Madri como total global de horas do Instituto.
 *
 * Prestadores considerados nesta integração:
 * - FCH - Victor Hugo
 * - FCH - Gabriel
 *
 * O parser procura os cabeçalhos pelo nome e NÃO por letra de coluna, pois os layouts das abas são diferentes.
 */

const FCH_SHEETS = ['FCH - Victor Hugo', 'FCH - Gabriel'];
const FCH_FILE_PREFIX = 'FCH - Formulário de Controle de Horas_';

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
    // Duração do Sheets/Excel normalmente é fração de um dia.
    return value <= 1.5 ? value * 24 : value;
  }
  const s = String(value).trim();
  const hm = s.match(/^(\d+):([0-5]\d)(?::([0-5]\d))?$/);
  if (hm) return Number(hm[1]) + Number(hm[2]) / 60 + Number(hm[3] || 0) / 3600;
  const n = Number(s.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, ''));
  if (!isFinite(n) || n <= 0) return 0;
  return n <= 1.5 ? n * 24 : n;
}

function monthKey_(value, fallbackName) {
  if (value instanceof Date && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone() || 'America/Sao_Paulo', 'yyyy-MM');
  }
  const s = String(value || '').trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return br[3] + '-' + String(br[2]).padStart(2, '0');
  const iso = s.match(/^(\d{4})-(\d{2})/);
  if (iso) return iso[1] + '-' + iso[2];
  // fallback simples para nomes como "..._Agosto 26"
  const months = { janeiro:'01', fevereiro:'02', marco:'03', abril:'04', maio:'05', junho:'06', julho:'07', agosto:'08', setembro:'09', outubro:'10', novembro:'11', dezembro:'12' };
  const nn = norm_(fallbackName);
  for (const k in months) {
    if (nn.indexOf(k) >= 0) {
      const yy = nn.match(/\b(20)?(\d{2})\b/);
      const year = yy ? (yy[1] ? yy[1] + yy[2] : '20' + yy[2]) : String(new Date().getFullYear());
      return year + '-' + months[k];
    }
  }
  return '';
}

function mapProject_(project) {
  const p = norm_(project).replace(/\s+/g, '');
  if (!p) return [];
  if (p.indexOf('oprmadri') >= 0) {
    return [
      { empresa: 'OPR', projeto: 'OPR' },
      { empresa: 'Madri', projeto: 'Madri' }
    ];
  }
  if (p.indexOf('dualclima') >= 0) return [{ empresa: 'Dual Clima', projeto: 'Dual Clima' }];
  if (p.indexOf('madri') >= 0) return [{ empresa: 'Madri', projeto: 'Madri' }];
  if (p === 'opr' || p.indexOf('rfpopr') >= 0) return [{ empresa: 'OPR', projeto: 'OPR' }];
  return [];
}

function consultantName_(sheetName) {
  return sheetName.replace(/^FCH\s*-?\s*/i, '').trim();
}

function collectFromSpreadsheet_(ss, fileName) {
  const output = [];
  FCH_SHEETS.forEach(sheetName => {
    const sh = ss.getSheetByName(sheetName);
    if (!sh) return;
    const values = sh.getDataRange().getValues();
    const h = findHeader_(values);
    if (!h) return;
    const consultant = consultantName_(sheetName);
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
        consultor: consultant,
        projeto_origem: sourceProject,
        origem_compartilhada: /opr.*madri|madri.*opr/i.test(norm_(sourceProject).replace(/\s+/g, '')) ? 'sim' : 'nao'
      }));
    }
  });
  return output;
}

function collectAll_() {
  const folderId = PropertiesService.getScriptProperties().getProperty('FCH_FOLDER_ID');
  if (!folderId) throw new Error('Defina FCH_FOLDER_ID nas propriedades do script.');
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  const rows = [];
  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    if (name.indexOf(FCH_FILE_PREFIX) !== 0) continue;
    if (file.getMimeType() !== MimeType.GOOGLE_SHEETS) continue;
    const ss = SpreadsheetApp.openById(file.getId());
    rows.push.apply(rows, collectFromSpreadsheet_(ss, name));
  }
  return rows;
}

function csvEscape_(value) {
  const s = String(value == null ? '' : value);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCSV_(rows) {
  const headers = ['empresa','projeto','hora','mes','consultor','projeto_origem','origem_compartilhada'];
  const lines = [headers.join(',')];
  rows.forEach(r => lines.push(headers.map(h => csvEscape_(r[h])).join(',')));
  return lines.join('\n');
}

function doGet() {
  try {
    const rows = collectAll_();
    return ContentService.createTextOutput(toCSV_(rows)).setMimeType(ContentService.MimeType.CSV);
  } catch (e) {
    return ContentService.createTextOutput('empresa,projeto,hora,mes,consultor,projeto_origem,origem_compartilhada\nERROR,ERROR,0,,,' + csvEscape_(String(e)) + ',nao')
      .setMimeType(ContentService.MimeType.CSV);
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
