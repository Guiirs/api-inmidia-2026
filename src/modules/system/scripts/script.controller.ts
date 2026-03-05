/**
 * Script Controller
 * Endpoints de scripts
 */
import { Request, Response } from 'express';
import scriptRunner from './script-runner.service';
import path from 'path';

const ALLOWED_SCRIPTS = new Set([
  'conversion/test_excel_to_pdf.js',
  'template-tools/analyze_contrato_template.js',
  'template-tools/add_placeholders_to_contrato.js',
]);

async function run(req: Request, res: Response): Promise<void> {
  const body = (req.body || {}) as {
    script?: string;
    args?: string[];
    background?: boolean;
  };

  const script = body.script;
  const args = Array.isArray(body.args) ? body.args : [];
  const background = Boolean(body.background);

  if (!script) {
    res.status(400).json({ error: 'script is required' });
    return;
  }

  const normalized = path.normalize(script).replace(/^\.\.[/\\]/, '');
  if (!ALLOWED_SCRIPTS.has(normalized)) {
    res.status(403).json({ error: 'script not allowed' });
    return;
  }

  try {
    const result = await scriptRunner.runScript(normalized, { args, background });
    res.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ ok: false, error: message });
  }
}

export { run };
