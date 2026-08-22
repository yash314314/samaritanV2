export default function SummaryCards({ data }: any) {

    return (
      <div className="grid grid-cols-4 gap-6">
  
        <Card title="Focus Score" value={data.assistant.focusScore} />
  
        <Card title="Deep Work %" value={data.assistant.deepWorkRatio} />
  
        <Card title="Burnout Risk" value={data.burnout.burnoutRisk} />
  
        <Card title="Deep Work Streak" value={data.streak.days} />
  
      </div>
    )
  }
  
  function Card({ title, value }: any) {
  
    return (
      <div className="samaritan-card p-6">
  
        <p className="text-sm text-zinc-500">
          {title}
        </p>
  
        <p className="text-3xl font-bold text-zinc-100">
          {value}
        </p>
  
      </div>
    )
  }
