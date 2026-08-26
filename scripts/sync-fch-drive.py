#!/usr/bin/env python3
"""Sincroniza o FCH do Google Drive com o Portal PMO em modo somente leitura.

Não altera a planilha. Usa apenas bibliotecas padrão do Python para ler o XLSX.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import io
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import zipfile
import xml.etree.ElementTree as ET

FILE_ID = os.getenv('FCH_DRIVE_FILE_ID', '1EwBf-iJyXsIKu5UoPP6iv-T9gnQQjPfH').strip()
FILE_NAME = os.getenv('FCH_DRIVE_FILE_NAME', 'FCH - Formulário de Controle de Horas_Agosto 26.xlsx').strip()
SHEETS = [x.strip() for x in os.getenv('FCH_SHEETS', 'FCH - Victor Hugo,FCH - Gabriel').split(',') if x.strip()]
INGEST_URLS = [x.strip() for x in os.getenv('PANEL_HOURS_INGEST_URLS', '').split(',') if x.strip()]
INGEST_TOKEN = os.getenv('HOURS_INGEST_TOKEN', '').strip()
DIRECT_URL = os.getenv('FCH_DRIVE_DOWNLOAD_URL', '').strip()

NS_MAIN = {'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
NS_REL = {'r': 'http://schemas.openxmlformats.org/package/2006/relationships'}
OFFICE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'


def norm(s: object) -> str:
    import unicodedata
    v = unicodedata.normalize('NFD', str(s or ''))
    v = ''.join(c for c in v if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', ' ', v.lower()).strip()


def http_json(url: str, data: dict | None = None, headers: dict | None = None, method: str | None = None):
    body = None if data is None else urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(url, data=body, headers=headers or {}, method=method)
    with urllib.request.urlopen(req, timeout=45) as resp:
        return json.loads(resp.read().decode('utf-8'))


def access_token() -> str:
    cid = os.getenv('GOOGLE_CLIENT_ID', '').strip()
    sec = os.getenv('GOOGLE_CLIENT_SECRET', '').strip()
    ref = os.getenv('GOOGLE_REFRESH_TOKEN', '').strip()
    if not (cid and sec and ref):
        raise RuntimeError('Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REFRESH_TOKEN, ou FCH_DRIVE_DOWNLOAD_URL.')
    payload = http_json('https://oauth2.googleapis.com/token', {
        'client_id': cid,
        'client_secret': sec,
        'refresh_token': ref,
        'grant_type': 'refresh_token',
    }, {'Content-Type': 'application/x-www-form-urlencoded'}, 'POST')
    token = payload.get('access_token')
    if not token:
        raise RuntimeError('Google OAuth não retornou access_token.')
    return token


def download_file() -> tuple[bytes, str, str]:
    if DIRECT_URL:
        req = urllib.request.Request(DIRECT_URL, headers={'User-Agent': 'Allamo-PMO-FCH/1.0'})
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.read(), FILE_NAME, ''
    token = access_token()
    auth = {'Authorization': 'Bearer ' + token}
    meta_url = 'https://www.googleapis.com/drive/v3/files/' + urllib.parse.quote(FILE_ID) + '?fields=id,name,modifiedTime,size'
    meta = http_json(meta_url, headers=auth)
    media_url = 'https://www.googleapis.com/drive/v3/files/' + urllib.parse.quote(FILE_ID) + '?alt=media'
    req = urllib.request.Request(media_url, headers=auth)
    with urllib.request.urlopen(req, timeout=90) as resp:
        data = resp.read()
    return data, str(meta.get('name') or FILE_NAME), str(meta.get('modifiedTime') or '')


def column_number(ref: str) -> int:
    m = re.match(r'([A-Z]+)', ref or 'A1')
    letters = m.group(1) if m else 'A'
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n


def shared_strings(zf: zipfile.ZipFile) -> list[str]:
    if 'xl/sharedStrings.xml' not in zf.namelist():
        return []
    root = ET.fromstring(zf.read('xl/sharedStrings.xml'))
    out = []
    for si in root.findall('a:si', NS_MAIN):
        out.append(''.join((t.text or '') for t in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')))
    return out


def workbook_sheets(zf: zipfile.ZipFile) -> dict[str, str]:
    wb = ET.fromstring(zf.read('xl/workbook.xml'))
    rels = ET.fromstring(zf.read('xl/_rels/workbook.xml.rels'))
    relmap = {r.attrib['Id']: r.attrib['Target'] for r in rels}
    out = {}
    for s in wb.find('a:sheets', NS_MAIN):
        rid = s.attrib['{' + OFFICE_REL + '}id']
        target = relmap[rid].lstrip('/')
        if not target.startswith('xl/'):
            target = 'xl/' + target
        out[s.attrib['name']] = target
    return out


def read_rows(zf: zipfile.ZipFile, sheet_xml: str, shared: list[str]) -> list[tuple[int, list[str]]]:
    root = ET.fromstring(zf.read(sheet_xml))
    rows = []
    for row in root.findall('.//a:sheetData/a:row', NS_MAIN):
        cells = {}
        max_col = 0
        for c in row.findall('a:c', NS_MAIN):
            idx = column_number(c.attrib.get('r', 'A1'))
            max_col = max(max_col, idx)
            typ = c.attrib.get('t')
            v = c.find('a:v', NS_MAIN)
            inline = c.find('a:is', NS_MAIN)
            val = ''
            if typ == 's' and v is not None:
                val = shared[int(v.text)]
            elif typ == 'inlineStr' and inline is not None:
                val = ''.join((t.text or '') for t in inline.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'))
            elif v is not None:
                val = v.text or ''
            cells[idx] = val
        vals = [cells.get(i, '') for i in range(1, max_col + 1)]
        rows.append((int(row.attrib.get('r', 0)), vals))
    return rows


def parse_date(value: str) -> str | None:
    s = str(value or '').strip()
    if not s:
        return None
    try:
        n = float(s)
        if 20000 < n < 80000:
            return (dt.datetime(1899, 12, 30) + dt.timedelta(days=n)).date().isoformat()
    except ValueError:
        pass
    for fmt in ('%d/%m/%Y', '%d/%m/%y', '%Y-%m-%d'):
        try:
            return dt.datetime.strptime(s[:10], fmt).date().isoformat()
        except ValueError:
            continue
    return None


def parse_hours(value: str) -> float:
    s = str(value or '').strip().replace(',', '.')
    if not s:
        return 0.0
    if ':' in s:
        parts = s.split(':')
        try:
            h = float(parts[0] or 0)
            m = float(parts[1] or 0) if len(parts) > 1 else 0
            sec = float(parts[2] or 0) if len(parts) > 2 else 0
            return h + m / 60 + sec / 3600
        except ValueError:
            return 0.0
    try:
        n = float(s)
    except ValueError:
        return 0.0
    # Excel armazena duração como fração do dia. Valores <= 1,5 são tratados como tempo Excel.
    return n * 24 if 0 < n <= 1.5 else n


def find_header(rows: list[tuple[int, list[str]]]):
    for row_no, vals in rows[:30]:
        keys = [norm(v) for v in vals]
        def locate(*terms):
            for i, key in enumerate(keys):
                if any(term in key for term in terms):
                    return i
            return -1
        date_i = locate('data')
        hour_i = locate('tempo da atividade', 'duracao', 'horas')
        project_i = locate('projeto')
        if date_i >= 0 and hour_i >= 0 and project_i >= 0:
            return row_no, date_i, hour_i, project_i
    return None


def targets(project: str) -> tuple[list[str], str]:
    p = norm(project)
    has_opr = bool(re.search(r'\bopr\b', p))
    has_madri = bool(re.search(r'\bmadri\b|\bmadrid\b', p))
    if has_opr and has_madri:
        return ['OPR', 'MADRI'], 'shared-opr-madri-100pct-each'
    if has_opr:
        return ['OPR'], 'direct-opr'
    if has_madri:
        return ['MADRI'], 'direct-madri'
    return [], ''


def parse_xlsx(data: bytes, file_name: str, modified_at: str) -> dict:
    zf = zipfile.ZipFile(io.BytesIO(data))
    shared = shared_strings(zf)
    sheet_map = workbook_sheets(zf)
    entries = []
    source_rows = 0
    for sheet in SHEETS:
        if sheet not in sheet_map:
            raise RuntimeError(f'Aba obrigatória não encontrada: {sheet}')
        rows = read_rows(zf, sheet_map[sheet], shared)
        header = find_header(rows)
        if not header:
            raise RuntimeError(f'Cabeçalhos Data/Tempo da Atividade/Projeto não encontrados em {sheet}')
        header_row, date_i, hour_i, project_i = header
        person = re.sub(r'^FCH\s*-?\s*', '', sheet, flags=re.I).strip()
        for row_no, vals in rows:
            if row_no <= header_row:
                continue
            def val(i): return vals[i] if 0 <= i < len(vals) else ''
            project = str(val(project_i) or '').strip()
            dests, rule = targets(project)
            if not dests:
                continue
            date = parse_date(val(date_i))
            hours = parse_hours(val(hour_i))
            if not date or hours <= 0 or hours > 24:
                continue
            source_rows += 1
            hours = round(hours, 4)
            raw = '|'.join([FILE_ID, sheet, str(row_no), date, person, project, f'{hours:.4f}'])
            source_hash = hashlib.sha256(raw.encode('utf-8')).hexdigest()
            for target in dests:
                entries.append({
                    'source_sheet': sheet,
                    'source_row': row_no,
                    'person': person,
                    'activity_date': date,
                    'source_project': project,
                    'target_project': target,
                    'allocation_rule': rule,
                    'source_entry_hash': source_hash,
                    'hours': hours,
                })
    return {
        'source_file_id': FILE_ID,
        'source_file_name': file_name,
        'source_modified_at': modified_at,
        'source_rows': source_rows,
        'entries': entries,
    }


def endpoint(url: str) -> str:
    u = url.rstrip('/')
    return u if u.endswith('/api/fch-hours-ingest') else u + '/api/fch-hours-ingest'


def post_payload(url: str, payload: dict):
    req = urllib.request.Request(
        endpoint(url),
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + INGEST_TOKEN,
            'User-Agent': 'Allamo-PMO-FCH/1.0',
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode('utf-8'))


def main() -> int:
    if not INGEST_URLS:
        print('[ABORTADO] PANEL_HOURS_INGEST_URLS não configurado.', file=sys.stderr)
        return 2
    if not INGEST_TOKEN:
        print('[ABORTADO] HOURS_INGEST_TOKEN não configurado.', file=sys.stderr)
        return 2
    data, file_name, modified_at = download_file()
    payload = parse_xlsx(data, file_name, modified_at)
    if not payload['entries']:
        print('[ABORTADO] Nenhuma hora OPR/MADRI encontrada no FCH.', file=sys.stderr)
        return 3
    results = []
    for url in INGEST_URLS:
        results.append({'url': endpoint(url), 'result': post_payload(url, payload)})
    unique = {}
    for e in payload['entries']:
        unique.setdefault(e['source_entry_hash'], e['hours'])
    summary = {
        'file': file_name,
        'modified_at': modified_at,
        'source_rows': payload['source_rows'],
        'allocations': len(payload['entries']),
        'capacity_hours': round(sum(unique.values()), 4),
        'opr_hours': round(sum(e['hours'] for e in payload['entries'] if e['target_project'] == 'OPR'), 4),
        'madri_hours': round(sum(e['hours'] for e in payload['entries'] if e['target_project'] == 'MADRI'), 4),
        'destinations': results,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
