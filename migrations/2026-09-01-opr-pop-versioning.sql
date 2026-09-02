PRAGMA foreign_keys = ON;

-- Versionamento documental do POP OPR.
-- Mantém snapshots imutáveis e não substitui opr_pop_history.
CREATE TABLE IF NOT EXISTS opr_pop_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  version_seq INTEGER NOT NULL,
  major_version INTEGER NOT NULL DEFAULT 1,
  minor_version INTEGER NOT NULL DEFAULT 0,
  version_label TEXT NOT NULL,
  document_title TEXT NOT NULL DEFAULT 'POP Operacional · OPR',
  document_status TEXT NOT NULL DEFAULT 'A confirmar',
  governance_owner TEXT NOT NULL DEFAULT 'PENDENTE DE VALIDAÇÃO',
  event_type TEXT NOT NULL,
  procedure_id TEXT,
  reason TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, version_seq)
);

CREATE INDEX IF NOT EXISTS idx_opr_pop_versions_project
  ON opr_pop_versions(company_id, project_id, version_seq DESC);

-- Backfill idempotente: POPs já existentes recebem snapshot da versão atual.
INSERT INTO opr_pop_versions(
  company_id,project_id,version_seq,major_version,minor_version,version_label,
  document_status,governance_owner,event_type,procedure_id,reason,actor,content_json
)
SELECT
  c.company_id,c.project_id,1,
  CASE WHEN instr(COALESCE(c.version,'1.0'),'.')>0 THEN CAST(substr(c.version,1,instr(c.version,'.')-1) AS INTEGER) ELSE 1 END,
  CASE WHEN instr(COALESCE(c.version,'1.0'),'.')>0 THEN CAST(substr(c.version,instr(c.version,'.')+1) AS INTEGER) ELSE 0 END,
  'v'||COALESCE(NULLIF(c.version,''),'1.0'),c.document_status,c.governance_owner,'BASELINE_MIGRATION',NULL,
  'Snapshot da versão corrente ao habilitar versionamento imutável',c.updated_by,
  json_object(
    'config',json_object('version',c.version,'status',c.document_status,'owner',c.governance_owner,'approver',c.approver,'objective',c.objective),
    'procedures',json(COALESCE((SELECT json_group_array(json_object(
      'id',p.display_id,'section',p.section,'procedure',p.procedure_text,'owner',p.owner,
      'trigger',p.trigger_frequency,'evidence',p.evidence,'done',p.done_criteria,
      'status',p.status,'next_step',p.next_step,'source',p.source,'version',p.version
    )) FROM opr_pop_procedures p WHERE p.project_id=c.project_id AND p.archived_at IS NULL),'[]'))
  )
FROM opr_pop_config c
WHERE c.initialized_at IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM opr_pop_versions v WHERE v.project_id=c.project_id);

-- Snapshot inicial para POP criado após esta migration.
CREATE TRIGGER IF NOT EXISTS trg_opr_pop_version_init
AFTER UPDATE OF initialized_at ON opr_pop_config
WHEN OLD.initialized_at IS NULL AND NEW.initialized_at IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM opr_pop_versions WHERE project_id=NEW.project_id)
BEGIN
  INSERT INTO opr_pop_versions(
    company_id,project_id,version_seq,major_version,minor_version,version_label,
    document_status,governance_owner,event_type,procedure_id,reason,actor,content_json
  ) VALUES(
    NEW.company_id,NEW.project_id,1,1,0,'v1.0',
    NEW.document_status,NEW.governance_owner,'INITIAL_VERSION',NULL,'Inicialização do POP OPR',NEW.updated_by,
    json_object(
      'config',json_object('version',NEW.version,'status',NEW.document_status,'owner',NEW.governance_owner,'approver',NEW.approver,'objective',NEW.objective),
      'procedures',json(COALESCE((SELECT json_group_array(json_object(
        'id',p.display_id,'section',p.section,'procedure',p.procedure_text,'owner',p.owner,
        'trigger',p.trigger_frequency,'evidence',p.evidence,'done',p.done_criteria,
        'status',p.status,'next_step',p.next_step,'source',p.source,'version',p.version
      )) FROM opr_pop_procedures p WHERE p.project_id=NEW.project_id AND p.archived_at IS NULL),'[]'))
    )
  );
END;

-- Inclusões posteriores ao bootstrap geram nova versão documental.
CREATE TRIGGER IF NOT EXISTS trg_opr_pop_version_insert
AFTER INSERT ON opr_pop_procedures
WHEN COALESCE((SELECT initialized_at FROM opr_pop_config WHERE project_id=NEW.project_id),'')<>''
BEGIN
  INSERT INTO opr_pop_versions(
    company_id,project_id,version_seq,major_version,minor_version,version_label,
    document_status,governance_owner,event_type,procedure_id,reason,actor,content_json
  ) VALUES(
    NEW.company_id,NEW.project_id,
    (SELECT COALESCE(MAX(version_seq),0)+1 FROM opr_pop_versions WHERE project_id=NEW.project_id),
    COALESCE((SELECT major_version FROM opr_pop_versions WHERE project_id=NEW.project_id ORDER BY version_seq DESC LIMIT 1),1),
    COALESCE((SELECT minor_version FROM opr_pop_versions WHERE project_id=NEW.project_id ORDER BY version_seq DESC LIMIT 1),-1)+1,
    'v'||COALESCE((SELECT major_version FROM opr_pop_versions WHERE project_id=NEW.project_id ORDER BY version_seq DESC LIMIT 1),1)||'.'||(COALESCE((SELECT minor_version FROM opr_pop_versions WHERE project_id=NEW.project_id ORDER BY version_seq DESC LIMIT 1),-1)+1),
    COALESCE((SELECT document_status FROM opr_pop_config WHERE project_id=NEW.project_id),'A confirmar'),
    COALESCE((SELECT governance_owner FROM opr_pop_config WHERE project_id=NEW.project_id),'PENDENTE DE VALIDAÇÃO'),
    'INSERT',NEW.id,'Inclusão do procedimento '||NEW.display_id,NEW.created_by,
    json_object(
      'config',json((SELECT json_object('version',c.version,'status',c.document_status,'owner',c.governance_owner,'approver',c.approver,'objective',c.objective) FROM opr_pop_config c WHERE c.project_id=NEW.project_id)),
      'procedures',json(COALESCE((SELECT json_group_array(json_object(
        'id',p.display_id,'section',p.section,'procedure',p.procedure_text,'owner',p.owner,
        'trigger',p.trigger_frequency,'evidence',p.evidence,'done',p.done_criteria,
        'status',p.status,'next_step',p.next_step,'source',p.source,'version',p.version
      )) FROM opr_pop_procedures p WHERE p.project_id=NEW.project_id AND p.archived_at IS NULL),'[]'))
    )
  );
END;

-- Edição, mudança de status, lixeira e restauração geram nova versão documental.
CREATE TRIGGER IF NOT EXISTS trg_opr_pop_version_update
AFTER UPDATE ON opr_pop_procedures
WHEN COALESCE((SELECT initialized_at FROM opr_pop_config WHERE project_id=NEW.project_id),'')<>''
BEGIN
  INSERT INTO opr_pop_versions(
    company_id,project_id,version_seq,major_version,minor_version,version_label,
    document_status,governance_owner,event_type,procedure_id,reason,actor,content_json
  ) VALUES(
    NEW.company_id,NEW.project_id,
    (SELECT COALESCE(MAX(version_seq),0)+1 FROM opr_pop_versions WHERE project_id=NEW.project_id),
    COALESCE((SELECT major_version FROM opr_pop_versions WHERE project_id=NEW.project_id ORDER BY version_seq DESC LIMIT 1),1),
    COALESCE((SELECT minor_version FROM opr_pop_versions WHERE project_id=NEW.project_id ORDER BY version_seq DESC LIMIT 1),-1)+1,
    'v'||COALESCE((SELECT major_version FROM opr_pop_versions WHERE project_id=NEW.project_id ORDER BY version_seq DESC LIMIT 1),1)||'.'||(COALESCE((SELECT minor_version FROM opr_pop_versions WHERE project_id=NEW.project_id ORDER BY version_seq DESC LIMIT 1),-1)+1),
    COALESCE((SELECT document_status FROM opr_pop_config WHERE project_id=NEW.project_id),'A confirmar'),
    COALESCE((SELECT governance_owner FROM opr_pop_config WHERE project_id=NEW.project_id),'PENDENTE DE VALIDAÇÃO'),
    CASE
      WHEN OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN 'SOFT_DELETE'
      WHEN OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN 'RESTORE'
      WHEN COALESCE(OLD.status,'')<>COALESCE(NEW.status,'') THEN 'STATUS_CHANGE'
      ELSE 'UPDATE'
    END,
    NEW.id,
    CASE
      WHEN OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN 'Procedimento enviado para lixeira: '||NEW.display_id
      WHEN OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN 'Procedimento restaurado: '||NEW.display_id
      WHEN COALESCE(OLD.status,'')<>COALESCE(NEW.status,'') THEN 'Alteração de status do procedimento '||NEW.display_id
      ELSE 'Atualização do procedimento '||NEW.display_id
    END,
    NEW.updated_by,
    json_object(
      'config',json((SELECT json_object('version',c.version,'status',c.document_status,'owner',c.governance_owner,'approver',c.approver,'objective',c.objective) FROM opr_pop_config c WHERE c.project_id=NEW.project_id)),
      'procedures',json(COALESCE((SELECT json_group_array(json_object(
        'id',p.display_id,'section',p.section,'procedure',p.procedure_text,'owner',p.owner,
        'trigger',p.trigger_frequency,'evidence',p.evidence,'done',p.done_criteria,
        'status',p.status,'next_step',p.next_step,'source',p.source,'version',p.version
      )) FROM opr_pop_procedures p WHERE p.project_id=NEW.project_id AND p.archived_at IS NULL),'[]'))
    )
  );
END;

-- Alterações relevantes de cabeçalho/configuração também são versionadas.
CREATE TRIGGER IF NOT EXISTS trg_opr_pop_version_config
AFTER UPDATE OF version,document_status,governance_owner,approver,objective ON opr_pop_config
WHEN NEW.initialized_at IS NOT NULL AND NEW.updated_at<>OLD.updated_at
BEGIN
  INSERT INTO opr_pop_versions(
    company_id,project_id,version_seq,major_version,minor_version,version_label,
    document_status,governance_owner,event_type,procedure_id,reason,actor,content_json
  ) VALUES(
    NEW.company_id,NEW.project_id,
    (SELECT COALESCE(MAX(version_seq),0)+1 FROM opr_pop_versions WHERE project_id=NEW.project_id),
    CASE WHEN COALESCE(NEW.version,'')<>COALESCE(OLD.version,'') AND instr(NEW.version,'.')>0 THEN CAST(substr(NEW.version,1,instr(NEW.version,'.')-1) AS INTEGER)
         ELSE COALESCE((SELECT major_version FROM opr_pop_versions WHERE project_id=NEW.project_id ORDER BY version_seq DESC LIMIT 1),1) END,
    CASE WHEN COALESCE(NEW.version,'')<>COALESCE(OLD.version,'') AND instr(NEW.version,'.')>0 THEN CAST(substr(NEW.version,instr(NEW.version,'.')+1) AS INTEGER)
         ELSE COALESCE((SELECT minor_version FROM opr_pop_versions WHERE project_id=NEW.project_id ORDER BY version_seq DESC LIMIT 1),-1)+1 END,
    CASE WHEN COALESCE(NEW.version,'')<>COALESCE(OLD.version,'') THEN 'v'||NEW.version
         ELSE 'v'||COALESCE((SELECT major_version FROM opr_pop_versions WHERE project_id=NEW.project_id ORDER BY version_seq DESC LIMIT 1),1)||'.'||(COALESCE((SELECT minor_version FROM opr_pop_versions WHERE project_id=NEW.project_id ORDER BY version_seq DESC LIMIT 1),-1)+1) END,
    NEW.document_status,NEW.governance_owner,'CONFIG_UPDATE',NULL,'Alteração de cabeçalho/configuração do POP',NEW.updated_by,
    json_object(
      'config',json_object('version',NEW.version,'status',NEW.document_status,'owner',NEW.governance_owner,'approver',NEW.approver,'objective',NEW.objective),
      'procedures',json(COALESCE((SELECT json_group_array(json_object(
        'id',p.display_id,'section',p.section,'procedure',p.procedure_text,'owner',p.owner,
        'trigger',p.trigger_frequency,'evidence',p.evidence,'done',p.done_criteria,
        'status',p.status,'next_step',p.next_step,'source',p.source,'version',p.version
      )) FROM opr_pop_procedures p WHERE p.project_id=NEW.project_id AND p.archived_at IS NULL),'[]'))
    )
  );
END;
