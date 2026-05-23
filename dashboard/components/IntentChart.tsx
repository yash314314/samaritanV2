import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip
  } from "recharts"
  
  export default function IntentChart({ intents }: any) {
  
    return (
      <div className="bg-white p-6 shadow rounded">
  
        <h2 className="text-lg mb-4">
          Intent Distribution
        </h2>
  
        <BarChart width={500} height={300} data={intents}>
  
          <XAxis dataKey="intent" />
  
          <YAxis />
  
          <Tooltip />
  
          <Bar dataKey="percentage" fill="#22c55e" />
  
        </BarChart>
  
      </div>
    )
  }