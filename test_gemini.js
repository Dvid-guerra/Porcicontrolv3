const API_KEY = "AIzaSyDyXIsSd3yWHWGecCbRuLyKrkyc2DCxpFA";
const systemPrompt = "Eres un asistente";
const geminiHistory = [
  { role: 'user', parts: [{ text: 'Hola' }] }
];

fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: geminiHistory
  })
})
.then(res => res.json())
.then(data => console.log(JSON.stringify(data, null, 2)))
.catch(err => console.error(err));
