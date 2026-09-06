#!/usr/bin/env python3
import argparse, os, sqlite3, sys, tempfile

def qident(v): return '"'+str(v).replace('"','""')+'"'
def qvalue(v):
    if v is None: return 'NULL'
    if isinstance(v,(int,float)): return repr(v)
    if isinstance(v,(bytes,bytearray)): return "X'"+bytes(v).hex()+"'"
    return "'"+str(v).replace("'","''")+"'"

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--input',required=True)
    ap.add_argument('--output',required=True)
    a=ap.parse_args()
    db=tempfile.NamedTemporaryFile(prefix='opr-backup-',suffix='.db',delete=False); db.close()
    try:
        con=sqlite3.connect(db.name)
        with open(a.input,'r',encoding='utf-8') as f: con.executescript(f.read())
        company=con.execute("SELECT * FROM companies WHERE lower(CAST(id AS TEXT))='opr' OR lower(name)='opr'").fetchall()
        if len(company)!=1: raise SystemExit(f'Backup inválido: esperado 1 tenant OPR, encontrado {len(company)}')
        projects=con.execute("SELECT * FROM projects WHERE lower(CAST(company_id AS TEXT))='opr'").fetchall()
        if len(projects)!=1: raise SystemExit(f'Backup inválido: esperado 1 projeto OPR, encontrado {len(projects)}')
        project_id=projects[0][0]
        if int(project_id)!=3: raise SystemExit(f'Backup inesperado: project_id OPR={project_id}, esperado 3')

        tables=[r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
        preferred=['companies','projects','project_reports','project_reports_p','report_records','report_versions','legacy_report_versions','work_items','opr_action_meta','opr_action_history','opr_cadence','opr_platform_sequence','opr_platform_audit','opr_pop_config','opr_pop_sequence','opr_pop_procedures','opr_pop_versions','opr_pop_history','opr_implementation_phases','opr_readiness','opr_report_publications']
        selected=[]
        for t in tables:
            cols=[r[1] for r in con.execute(f'PRAGMA table_info({qident(t)})')]
            if t=='companies':
                rows=con.execute(f'SELECT * FROM {qident(t)} WHERE lower(CAST(id AS TEXT))=?',('opr',)).fetchall()
            elif 'company_id' in cols:
                rows=con.execute(f'SELECT * FROM {qident(t)} WHERE lower(CAST(company_id AS TEXT))=?',('opr',)).fetchall()
            else:
                rows=[]
            if rows: selected.append((t,cols,rows))
        selected.sort(key=lambda x:(preferred.index(x[0]) if x[0] in preferred else 999,x[0]))

        total=0
        with open(a.output,'w',encoding='utf-8',newline='\n') as out:
            out.write('-- OPR-only recovery generated from verified D1 export.\n')
            out.write('-- Safety: only tenant id/company_id=opr rows are included.\n')
            for t,cols,rows in selected:
                for row in rows:
                    stmt='INSERT OR IGNORE INTO '+qident(t)+' ('+','.join(qident(c) for c in cols)+') VALUES('+','.join(qvalue(v) for v in row)+');\n'
                    out.write(stmt); total+=1
            out.write("SELECT 'OPR_RESTORE_OK' AS status;\n")
        print(f'OPR restore preparado: {total} INSERT OR IGNORE em {len(selected)} tabelas; project_id={project_id}.')
        print('Tabelas: '+', '.join(t for t,_,_ in selected))
    finally:
        try: os.unlink(db.name)
        except OSError: pass

if __name__=='__main__': main()
