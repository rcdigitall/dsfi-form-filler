export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ILOVEPDF_PUBLIC = 'project_public_8a1b11ee5492d1a56b09506622bacd55_YPLksbdfc1c7acbbbc1f617c571ac10ecf640';

  try {
    const { imageBase64, fileName } = req.body;

    // 1. Auth
    const authRes = await fetch('https://api.ilovepdf.com/v1/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_key: ILOVEPDF_PUBLIC })
    });
    const { token } = await authRes.json();

    // 2. Start imagepdf task
    const startRes = await fetch('https://api.ilovepdf.com/v1/start/imagepdf', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const { server, task } = await startRes.json();

    // 3. Upload image
    const imgBuffer = Buffer.from(imageBase64, 'base64');
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('task', task);
    formData.append('file', imgBuffer, { filename: fileName || 'image.jpg' });

    const uploadRes = await fetch(`https://${server}/v1/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, ...formData.getHeaders() },
      body: formData
    });
    const uploadData = await uploadRes.json();

    // 4. Process
    await fetch(`https://${server}/v1/process`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task,
        tool: 'imagepdf',
        files: [{ server_filename: uploadData.server_filename, filename: fileName }]
      })
    });

    // 5. Download PDF
    const downloadRes = await fetch(`https://${server}/v1/download/${task}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const pdfBuffer = await downloadRes.arrayBuffer();
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');

    return res.status(200).json({ success: true, pdfBase64 });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
