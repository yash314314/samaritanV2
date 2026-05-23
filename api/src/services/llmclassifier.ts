export async function llmClassify(app: string, title: string) {
    const prompt = `
  You are a productivity assistant classifier.
  
  Classify this activity:
  
  App: ${app}
  Title: ${title}
  
  Return ONLY valid JSON:
  
  {
    "category": "deep_work | shallow_work | communication | learning | research | administrative | planning | creative | entertainment | break | unknown",
    "intent": "short_snake_case_label",
    "focusImpact": 0-1,
    "energyImpact": -1 to 1,
    "confidence": 0-1
  }
  `;
  
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "phi3",
        prompt,
        stream: false
      })
    });
  
    const data = await response.json();
  
    try {
      return JSON.parse(data.response);
    } catch {
      return {
        category: "unknown",
        intent: "unknown",
        focusImpact: 0.5,
        energyImpact: 0,
        confidence: 0.3
      };
    }
  }