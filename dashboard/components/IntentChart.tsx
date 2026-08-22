import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip
  } from "recharts"
  
  export default function IntentChart({ intents }: any) {
  
    return (
      <div className="samaritan-card p-6">
  
        <h2 className="text-lg mb-4 text-zinc-100">
          Intent Distribution
        </h2>
  
        <BarChart width={500} height={300} data={intents}>
  
          <XAxis dataKey="intent" />
  
          <YAxis />
  
          <Tooltip />
  
          <Bar dataKey="percentage" fill="#a855f7" />
  
        </BarChart>
  
      </div>
    )
  }
