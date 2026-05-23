

export default function MetricsCard() {
    return (
      <div className="bg-zinc-900 rounded-xl p-5 space-y-4">
  
        <h2 className="text-lg font-semibold">Productivity</h2>
  
        <div className="grid grid-cols-2 gap-3 text-sm">
  
          <Metric label="Focus Time" value="3h 10m" />
          <Metric label="Deep Work" value="1h 22m" />
  
          <Metric label="Distraction" value="32m" />
          <Metric label="Switches" value="128" />
  
          <Metric label="Entropy" value="0.63" />
          <Metric label="Active Time" value="5h 20m" />
  
        </div>
  
        <div className="border-t border-zinc-700 pt-3 text-sm">
          <Metric label="Focus Score" value="78%" />
          <Metric label="Burnout Risk" value="Low" />
        </div>
  
      </div>
    )
  }
  
  function Metric({ label, value }: any) {
    return (
      <div className="flex justify-between">
        <span className="text-zinc-400">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
    )
  }