export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

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

    // 2. Start
    const startRes = await fetch('https://api.ilovepdf.com/v1/start/imagepdf', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const { server, task } = await startRes.json();

    // 3. Upload
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const imgBuffer = Buffer.from(imageBase64, 'base64');
    const contentType = fileName?.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
    
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="task"\r\n\r\n`),
      Buffer.from(`${task}\r\n`),
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName || 'image.jpg'}"\r\n`),
      Buffer.from(`Content-Type: ${contentType}\r\n\r\n`),
      imgBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const uploadRes = await fetch(`https://${server}/v1/upload`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: body
    });
    const uploadData = await uploadRes.json();

    if (!uploadData.server_filename) {
      throw new Error('Upload failed: ' + JSON.stringify(uploadData));
    }

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
