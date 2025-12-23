export default async function handler(req, res) {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ILOVEPDF_PUBLIC = 'project_public_8a1b11ee5492d1a56b09506622bacd55_YPLksbdfc1c7acbbbc1f617c571ac10ecf640';
  const ILOVEPDF_SECRET = 'secret_key_31c69ed0b550531225a3ff29ca9d0aed_shRAg3ca20b25beafda71c239721187d44a68';

  try {
    const { fileBase64, fileName } = req.body;

    // 1. Autenticar
    const authRes = await fetch('https://api.ilovepdf.com/v1/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_key: ILOVEPDF_PUBLIC })
    });
    const authData = await authRes.json();
    const token = authData.token;

    // 2. Iniciar tarefa PDF to Word
    const startRes = await fetch('https://api.ilovepdf.com/v1/start/pdfoffice', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const startData = await startRes.json();
    const { server, task } = startData;

    // 3. Upload do arquivo
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('task', task);
    formData.append('file', fileBuffer, { filename: fileName || 'document.pdf' });

    const uploadRes = await fetch(`https://${server}/v1/upload`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    const uploadData = await uploadRes.json();

    // 4. Processar conversão
    const processRes = await fetch(`https://${server}/v1/process`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        task: task,
        tool: 'pdfoffice',
        files: [{ server_filename: uploadData.server_filename, filename: fileName }]
      })
    });
    await processRes.json();

    // 5. Download
    const downloadRes = await fetch(`https://${server}/v1/download/${task}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const wordBuffer = await downloadRes.arrayBuffer();
    const wordBase64 = Buffer.from(wordBuffer).toString('base64');

    return res.status(200).json({ 
      success: true, 
      wordBase64,
      filename: fileName.replace(/\.[^/.]+$/, '') + '.docx'
    });

  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({ error: error.message });
  }
}
